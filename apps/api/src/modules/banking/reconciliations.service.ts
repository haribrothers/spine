import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  MATCH_SUM_MISMATCH,
  RECONCILE_AFTER,
  formatMoney,
  type ReconciliationEntry,
  type ReconciliationSummary,
  type ReconciliationView,
  type SaveReconciliationMatchesInput,
  type StartReconciliationInput,
} from "@spine/shared";
import { orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { bankReconciliations, bankStatementImports, bankStatementLineMatches, bankStatementLines, journalEntries, journalLines, moneyAccounts, user } from "../../db/schema";
import { AccountRegisterService } from "./account-register.service";
import { MoneyAccountsService } from "./money-accounts.service";
import { toStatementLine } from "./statement-imports.service";

type ReconciliationRow = typeof bankReconciliations.$inferSelect;

/** "Oct 4, 2026" in the organisation's locale, for messages. */
export function messageDate(date: string, locale: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * US-BANK-08 (D-158, D-176) — reconciling a money account to a statement.
 * Matches and exclusions are saved as the person goes. The cleared balance
 * is the opening balance plus the matched entries and the excluded lines;
 * the difference is what the statement says less that.
 */
@Injectable()
export class ReconciliationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly register: AccountRegisterService,
  ) {}

  async list(orgId: string, moneyAccountId: string, status?: ReconciliationRow["status"]): Promise<ReconciliationSummary[]> {
    await this.moneyAccounts.get(orgId, moneyAccountId);
    const rows = await this.db
      .select({ rec: bankReconciliations, finishedByName: user.name })
      .from(bankReconciliations)
      .leftJoin(user, eq(user.id, bankReconciliations.finishedByUserId))
      .where(and(eq(bankReconciliations.orgId, orgId), eq(bankReconciliations.moneyAccountId, moneyAccountId), status ? eq(bankReconciliations.status, status) : undefined))
      .orderBy(desc(bankReconciliations.statementEndDate), desc(bankReconciliations.createdAt));
    const latest = await this.latestFinished(this.db, moneyAccountId);
    const counts = await this.matchCounts(rows.map((r) => r.rec.id));
    return rows.map((r) => this.toSummary(r.rec, r.finishedByName, counts.get(r.rec.id) ?? 0, latest?.id === r.rec.id));
  }

  async start(orgId: string, actorUserId: string, input: StartReconciliationInput): Promise<ReconciliationView> {
    const id = await this.db.transaction(async (tx) => {
      await this.moneyAccounts.requireActive(tx, orgId, input.moneyAccountId);
      // One at a time per account: lock the account row while checking.
      await tx.select({ id: moneyAccounts.id }).from(moneyAccounts).where(eq(moneyAccounts.id, input.moneyAccountId)).for("update");
      const latest = await this.latestFinished(tx, input.moneyAccountId);
      if (latest && input.statementEndDate <= latest.statementEndDate) {
        const { locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(RECONCILE_AFTER(messageDate(latest.statementEndDate, locale)));
      }
      const [open] = await tx
        .select()
        .from(bankReconciliations)
        .where(and(eq(bankReconciliations.moneyAccountId, input.moneyAccountId), eq(bankReconciliations.status, "in_progress")));
      if (open) {
        await tx
          .update(bankReconciliations)
          .set({ statementEndDate: input.statementEndDate, statementClosingBalance: input.statementClosingBalance, updatedAt: new Date() })
          .where(eq(bankReconciliations.id, open.id));
        // Moving the end date earlier drops matches on lines or entries after it.
        await this.dropMatchesAfter(tx, open.id, input.statementEndDate);
        return open.id;
      }
      const [created] = await tx
        .insert(bankReconciliations)
        .values({ orgId, moneyAccountId: input.moneyAccountId, statementEndDate: input.statementEndDate, statementClosingBalance: input.statementClosingBalance, startedByUserId: actorUserId })
        .returning();
      return created!.id;
    });
    return this.get(orgId, id);
  }

  async get(orgId: string, id: string): Promise<ReconciliationView> {
    const rec = await this.load(this.db, orgId, id);
    const account = await this.moneyAccounts.get(orgId, rec.moneyAccountId);
    const sense = account.kind === "card" ? -1n : 1n;
    const [finishedBy] = rec.finishedByUserId ? await this.db.select({ name: user.name }).from(user).where(eq(user.id, rec.finishedByUserId)) : [];
    const latest = await this.latestFinished(this.db, rec.moneyAccountId);

    // Statement lines up to the end date: unmatched ones, and those this reconciliation matched or excluded.
    const lineRows = await this.db
      .select({ line: bankStatementLines, fileName: bankStatementImports.fileName })
      .from(bankStatementLines)
      .innerJoin(bankStatementImports, eq(bankStatementImports.id, bankStatementLines.importId))
      .where(
        and(
          eq(bankStatementLines.moneyAccountId, rec.moneyAccountId),
          lte(bankStatementLines.date, rec.statementEndDate),
          rec.status === "in_progress" ? or(eq(bankStatementLines.status, "unmatched"), eq(bankStatementLines.reconciliationId, rec.id)) : eq(bankStatementLines.reconciliationId, rec.id),
        ),
      )
      .orderBy(asc(bankStatementLines.date), asc(bankStatementLines.createdAt), asc(bankStatementLines.rowNumber));

    const { opening, broughtForwardBefore } = await this.openingBalance(rec, lineRows.map((r) => r.line.date), latest, sense);

    const matchRows = await this.db.select().from(bankStatementLineMatches).where(eq(bankStatementLineMatches.reconciliationId, rec.id));
    const matchedTo = new Map(matchRows.map((m) => [m.journalLineId, m.statementLineId]));
    const entryRows = await this.candidateEntries(rec, account.accountId, broughtForwardBefore, [...matchedTo.keys()]);
    const described = await this.register.describe(orgId, entryRows);
    const entries: ReconciliationEntry[] = entryRows.map(({ line, entry }) => {
      const about = described.get(line.id)!;
      return {
        journalLineId: line.id,
        date: entry.date,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        what: about.what,
        contact: about.contact,
        reference: about.reference,
        amount: (line.debit - line.credit).toString(),
        statementLineId: matchedTo.get(line.id) ?? null,
      };
    });

    const matches = [...new Set(matchRows.map((m) => m.statementLineId))].map((statementLineId) => ({
      statementLineId,
      journalLineIds: matchRows.filter((m) => m.statementLineId === statementLineId).map((m) => m.journalLineId),
    }));
    const entryAmount = new Map(entries.map((e) => [e.journalLineId, BigInt(e.amount)]));
    const matchedSum = matchRows.reduce((sum, m) => sum + (entryAmount.get(m.journalLineId) ?? 0n), 0n);
    const excludedSum = lineRows.filter((r) => r.line.status === "excluded").reduce((sum, r) => sum + r.line.amount, 0n);
    const cleared = opening + sense * (matchedSum + excludedSum);

    return {
      ...this.toSummary(rec, finishedBy?.name ?? null, matches.length, latest?.id === rec.id),
      moneyAccount: { id: account.id, name: account.name, kind: account.kind },
      openingBalance: opening.toString(),
      broughtForwardBefore,
      lastReconciledOn: latest?.statementEndDate ?? null,
      statementLines: lineRows.map((r) => toStatementLine(r.line, r.fileName)),
      entries,
      matches,
      suggestions: rec.status === "in_progress" ? suggest(lineRows.map((r) => r.line).filter((l) => l.status === "unmatched"), entries.filter((e) => !e.statementLineId)) : [],
      matchedCount: matches.length + lineRows.filter((r) => r.line.status === "excluded").length,
      clearedBalance: cleared.toString(),
      difference: (rec.statementClosingBalance - cleared).toString(),
      fileNames: [...new Set(lineRows.map((r) => r.fileName))],
    };
  }

  /** Replaces the reconciliation's matches and exclusions with these. */
  async saveMatches(orgId: string, id: string, input: SaveReconciliationMatchesInput): Promise<ReconciliationView> {
    await this.db.transaction(async (tx) => {
      const rec = await this.load(tx, orgId, id, true);
      if (rec.status !== "in_progress") throw new BadRequestException("This reconciliation is finished. Undo it to change its matches.");
      const account = await this.moneyAccounts.get(orgId, rec.moneyAccountId);

      const lineIds = [...input.matches.map((m) => m.statementLineId), ...input.exclusions.map((e) => e.statementLineId)];
      if (new Set(lineIds).size !== lineIds.length) throw new BadRequestException("A statement line can be matched or excluded only once.");
      const journalLineIds = input.matches.flatMap((m) => m.journalLineIds);
      if (new Set(journalLineIds).size !== journalLineIds.length) throw new BadRequestException("An entry can match only one statement line.");

      const lines = lineIds.length ? await tx.select().from(bankStatementLines).where(inArray(bankStatementLines.id, lineIds)) : [];
      const lineById = new Map(lines.map((l) => [l.id, l]));
      for (const lineId of lineIds) {
        const line = lineById.get(lineId);
        if (!line || line.moneyAccountId !== rec.moneyAccountId) throw new BadRequestException("That statement line isn't on this account.");
        if (line.date > rec.statementEndDate) throw new BadRequestException("That statement line is after the statement end date.");
        if (line.status !== "unmatched" && line.reconciliationId !== rec.id) throw new BadRequestException("That statement line is already reconciled.");
      }

      const jl = journalLineIds.length
        ? await tx
            .select({ line: journalLines, date: journalEntries.date })
            .from(journalLines)
            .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
            .where(inArray(journalLines.id, journalLineIds))
        : [];
      const jlById = new Map(jl.map((r) => [r.line.id, r]));
      const otherMatches = journalLineIds.length
        ? await tx
            .select({ journalLineId: bankStatementLineMatches.journalLineId })
            .from(bankStatementLineMatches)
            .where(and(inArray(bankStatementLineMatches.journalLineId, journalLineIds), sql`${bankStatementLineMatches.reconciliationId} <> ${rec.id}`))
        : [];
      if (otherMatches.length) throw new BadRequestException("That entry is already reconciled.");
      const { currency, locale } = await orgMoneySettings(this.db, orgId);
      for (const match of input.matches) {
        let sum = 0n;
        for (const journalLineId of match.journalLineIds) {
          const row = jlById.get(journalLineId);
          if (!row || row.line.accountId !== account.accountId) throw new BadRequestException("That entry isn't on this account.");
          if (row.date > rec.statementEndDate) throw new BadRequestException("That entry is after the statement end date.");
          sum += row.line.debit - row.line.credit;
        }
        const line = lineById.get(match.statementLineId)!;
        if (sum !== line.amount) throw new BadRequestException(MATCH_SUM_MISMATCH(formatMoney(sum, currency, locale), formatMoney(line.amount, currency, locale)));
      }

      await tx.delete(bankStatementLineMatches).where(eq(bankStatementLineMatches.reconciliationId, rec.id));
      await tx
        .update(bankStatementLines)
        .set({ status: "unmatched", excludeNote: null, reconciliationId: null })
        .where(eq(bankStatementLines.reconciliationId, rec.id));
      for (const match of input.matches) {
        await tx.update(bankStatementLines).set({ status: "matched", reconciliationId: rec.id }).where(eq(bankStatementLines.id, match.statementLineId));
        await tx.insert(bankStatementLineMatches).values(match.journalLineIds.map((journalLineId) => ({ statementLineId: match.statementLineId, journalLineId, reconciliationId: rec.id })));
      }
      for (const exclusion of input.exclusions) {
        await tx.update(bankStatementLines).set({ status: "excluded", excludeNote: exclusion.note || null, reconciliationId: rec.id }).where(eq(bankStatementLines.id, exclusion.statementLineId));
      }
      await tx.update(bankReconciliations).set({ updatedAt: new Date() }).where(eq(bankReconciliations.id, rec.id));
    });
    return this.get(orgId, id);
  }

  /** The most recent finished reconciliation of an account. */
  async latestFinished(db: Database | Transaction, moneyAccountId: string): Promise<ReconciliationRow | undefined> {
    const [row] = await db
      .select()
      .from(bankReconciliations)
      .where(and(eq(bankReconciliations.moneyAccountId, moneyAccountId), eq(bankReconciliations.status, "finished")))
      .orderBy(desc(bankReconciliations.statementEndDate), desc(bankReconciliations.finishedAt))
      .limit(1);
    return row;
  }

  async load(db: Database | Transaction, orgId: string, id: string, lock = false): Promise<ReconciliationRow> {
    const query = db.select().from(bankReconciliations).where(and(eq(bankReconciliations.orgId, orgId), eq(bankReconciliations.id, id)));
    const [row] = lock ? await query.for("update") : await query;
    if (!row) throw new NotFoundException("Reconciliation not found");
    return row;
  }

  /**
   * The balance this reconciliation starts from: the last one's closing
   * balance, else (D-176) Spine's balance before the earliest statement line,
   * which the first reconciliation brings forward. Fixed once finished.
   */
  async openingBalance(rec: ReconciliationRow, lineDates: string[], latest: ReconciliationRow | undefined, sense: bigint): Promise<{ opening: bigint; broughtForwardBefore: string | null }> {
    if (rec.status !== "in_progress") return { opening: rec.openingBalance ?? 0n, broughtForwardBefore: rec.broughtForwardBefore };
    if (latest) return { opening: latest.statementClosingBalance, broughtForwardBefore: null };
    const earliest = lineDates.length ? lineDates.reduce((a, b) => (a < b ? a : b)) : null;
    if (!earliest) return { opening: 0n, broughtForwardBefore: null };
    const account = await this.db.select({ accountId: moneyAccounts.accountId }).from(moneyAccounts).where(eq(moneyAccounts.id, rec.moneyAccountId));
    const [before] = await this.db
      .select({ net: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalLines.accountId, account[0]!.accountId), lt(journalEntries.date, earliest)));
    return { opening: sense * BigInt(before?.net ?? "0"), broughtForwardBefore: earliest };
  }

  /**
   * Entries a statement line could match: on the account, up to the end date
   * (from the brought-forward date on a first reconciliation), not yet
   * reconciled. An entry and its own reversal (a deleted document) cancel
   * out and are left out, unless one is already matched here.
   */
  async candidateEntries(rec: ReconciliationRow, ledgerAccountId: string, broughtForwardBefore: string | null, matchedIds: string[]) {
    const rows = await this.db
      .select({ line: journalLines, entry: journalEntries })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(
        and(
          eq(journalLines.accountId, ledgerAccountId),
          lte(journalEntries.date, rec.statementEndDate),
          broughtForwardBefore ? gte(journalEntries.date, broughtForwardBefore) : undefined,
          rec.status === "in_progress" ? reconciledIsNull() : matchedIds.length ? inArray(journalLines.id, matchedIds) : sql`false`,
        ),
      )
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt), asc(journalLines.id));
    const matched = new Set(matchedIds);
    const entryIds = new Set(rows.map((r) => r.entry.id));
    const pairs = new Set<string>();
    for (const r of rows) {
      if (r.entry.reversedById && entryIds.has(r.entry.reversedById)) {
        pairs.add(r.entry.id);
        pairs.add(r.entry.reversedById);
      }
    }
    return rows.filter((r) => matched.has(r.line.id) || !pairs.has(r.entry.id));
  }

  private async dropMatchesAfter(tx: Transaction, recId: string, endDate: string) {
    const late = await tx
      .select({ id: bankStatementLines.id })
      .from(bankStatementLines)
      .where(and(eq(bankStatementLines.reconciliationId, recId), sql`${bankStatementLines.date} > ${endDate}`));
    const lateEntries = await tx
      .select({ statementLineId: bankStatementLineMatches.statementLineId })
      .from(bankStatementLineMatches)
      .innerJoin(journalLines, eq(journalLines.id, bankStatementLineMatches.journalLineId))
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(bankStatementLineMatches.reconciliationId, recId), sql`${journalEntries.date} > ${endDate}`));
    const lineIds = [...new Set([...late.map((l) => l.id), ...lateEntries.map((l) => l.statementLineId)])];
    if (!lineIds.length) return;
    await tx.delete(bankStatementLineMatches).where(inArray(bankStatementLineMatches.statementLineId, lineIds));
    await tx.update(bankStatementLines).set({ status: "unmatched", excludeNote: null, reconciliationId: null }).where(inArray(bankStatementLines.id, lineIds));
  }

  private async matchCounts(recIds: string[]): Promise<Map<string, number>> {
    if (!recIds.length) return new Map();
    const rows = await this.db
      .select({ id: bankStatementLineMatches.reconciliationId, n: sql<number>`count(*)::int` })
      .from(bankStatementLineMatches)
      .where(inArray(bankStatementLineMatches.reconciliationId, recIds))
      .groupBy(bankStatementLineMatches.reconciliationId);
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  private toSummary(rec: ReconciliationRow, finishedByName: string | null, entriesMatched: number, isLatest: boolean): ReconciliationSummary {
    return {
      id: rec.id,
      moneyAccountId: rec.moneyAccountId,
      status: rec.status,
      statementEndDate: rec.statementEndDate,
      statementClosingBalance: rec.statementClosingBalance.toString(),
      entriesMatched,
      finishedBy: rec.finishedByUserId && finishedByName ? { id: rec.finishedByUserId, name: finishedByName } : null,
      finishedAt: rec.finishedAt ? rec.finishedAt.toISOString() : null,
      isLatest,
    };
  }
}

/** Until US-BANK-10 marks journal lines reconciled, every entry is a candidate. */
function reconciledIsNull() {
  return isNull(sql`null`);
}

/**
 * D-158 — for each unmatched line, oldest first, the one unmatched entry of
 * the same amount within 3 days, if there's exactly one; an entry is
 * suggested for one line at most.
 */
export function suggest(
  lines: { id: string; date: string; amount: bigint }[],
  entries: { journalLineId: string; date: string; amount: string }[],
): { statementLineId: string; journalLineId: string }[] {
  const used = new Set<string>();
  const out: { statementLineId: string; journalLineId: string }[] = [];
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  for (const line of lines) {
    const candidates = entries.filter((e) => !used.has(e.journalLineId) && BigInt(e.amount) === line.amount && Math.abs(day(e.date) - day(line.date)) <= 3);
    if (candidates.length !== 1) continue;
    used.add(candidates[0]!.journalLineId);
    out.push({ statementLineId: line.id, journalLineId: candidates[0]!.journalLineId });
  }
  return out;
}
