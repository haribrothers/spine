import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, like, lt, notLike, sql } from "drizzle-orm";
import {
  OPENING_ADJUSTMENTS_CODE,
  OPENING_DOCUMENTS_BEFORE,
  OPENING_FROM_DOCUMENTS,
  OPENING_LOCKED,
  dayBefore,
  type OpeningBalanceAccountRow,
  type OpeningBalancesView,
  type SaveOpeningBalancesInput,
} from "@spine/shared";
import { formatMessageDate, orgMoneySettings } from "../../common/money-format";
import { orgClock } from "../../common/org-clock";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, fiscalPeriods, invoices, journalEntries, journalLines, openingBalanceLines, openingBalances, payments, vendorBills, vendorCredits } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService, type PostingLine } from "../ledger/ledger.service";
import { SettingsService } from "../org/settings.service";

type OpeningRow = typeof openingBalances.$inferSelect;

/** The closed period made by locking starts here, so every date before the cutover date is covered (I17). */
const OPENING_PERIOD_START = "1900-01-01";

/** How each opening document points at its entry, so re-dating can move it (US-RPT-17, US-RPT-18). */
const OPENING_DOCUMENT_POINTERS: Record<string, (tx: Transaction, id: string, entryId: string) => Promise<unknown>> = {
  opening_invoice: (tx, id, entryId) => tx.update(invoices).set({ journalEntryId: entryId }).where(eq(invoices.id, id)),
  opening_customer_credit: (tx, id, entryId) => tx.update(payments).set({ journalEntryId: entryId }).where(eq(payments.id, id)),
  opening_bill: (tx, id, entryId) => tx.update(vendorBills).set({ journalEntryId: entryId }).where(eq(vendorBills.id, id)),
  opening_vendor_credit: (tx, id, entryId) => tx.update(vendorCredits).set({ entryId }).where(eq(vendorCredits.id, id)),
};

/** Labels for the read-only rows, by code. */
const FROM_DOCUMENTS_LABEL: Record<string, string> = {
  "1100": "From opening invoices",
  "1150": "From opening invoices",
  "2000": "From opening bills",
  "2200": "From opening credit",
};

/**
 * US-RPT-16 (D-137) — the cutover date and the balance of every account on
 * it. Saving re-posts P17 (the old entry reversed, a new one posted) dated
 * the day before the cutover date; the entered balances' difference goes to
 * 3900 Opening Balance Adjustments. Opening documents (US-RPT-17, US-RPT-18)
 * post their own entries, all with an `opening_` source type.
 */
@Injectable()
export class OpeningBalancesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(orgId: string): Promise<OpeningBalancesView> {
    const [row] = await this.db.select().from(openingBalances).where(eq(openingBalances.orgId, orgId));
    const cutoverDate = row?.cutoverDate ?? (await this.defaultCutover(orgId));
    const lines = row ? await this.db.select().from(openingBalanceLines).where(eq(openingBalanceLines.orgId, orgId)) : [];
    const byAccount = new Map(lines.map((l) => [l.accountId, l]));
    const fromDocuments = await this.documentBalances(this.db, orgId);
    const chart = await this.db.select().from(accounts).where(eq(accounts.orgId, orgId)).orderBy(asc(accounts.code));

    let totalDebit = 0n;
    let totalCredit = 0n;
    const rows: OpeningBalanceAccountRow[] = [];
    for (const account of chart) {
      if (account.code === OPENING_ADJUSTMENTS_CODE) continue;
      const entered = byAccount.get(account.id);
      const isDocument = (OPENING_FROM_DOCUMENTS as readonly string[]).includes(account.code);
      const net = fromDocuments.get(account.id) ?? 0n;
      const docs = isDocument ? { label: FROM_DOCUMENTS_LABEL[account.code]!, debit: (net > 0n ? net : 0n).toString(), credit: (net < 0n ? -net : 0n).toString() } : null;
      totalDebit += (entered?.debit ?? 0n) + (net > 0n && isDocument ? net : 0n);
      totalCredit += (entered?.credit ?? 0n) + (net < 0n && isDocument ? -net : 0n);
      rows.push({
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit: (entered?.debit ?? 0n).toString(),
        credit: (entered?.credit ?? 0n).toString(),
        fromDocuments: docs,
      });
    }
    return {
      status: !row ? "not_started" : row.status,
      cutoverDate,
      balancesAsOf: dayBefore(cutoverDate),
      lockedAt: row?.lockedAt ? row.lockedAt.toISOString() : null,
      accounts: rows,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      adjustment: (totalDebit - totalCredit).toString(),
    };
  }

  async save(orgId: string, actorUserId: string, input: SaveOpeningBalancesInput): Promise<OpeningBalancesView> {
    await this.db.transaction(async (tx) => {
      const row = await this.lockRow(tx, orgId);
      if (row?.status === "locked") throw new BadRequestException(OPENING_LOCKED);
      await this.requireNothingBefore(tx, orgId, input.cutoverDate);

      const lines = input.lines.filter((l) => l.debit > 0n || l.credit > 0n);
      const chart = lines.length ? await tx.select().from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.id, lines.map((l) => l.accountId)))) : [];
      const byId = new Map(chart.map((a) => [a.id, a]));
      for (const line of lines) {
        const account = byId.get(line.accountId);
        if (!account) throw new BadRequestException("That account isn't in your chart of accounts.");
        if ((OPENING_FROM_DOCUMENTS as readonly string[]).includes(account.code)) throw new BadRequestException(`${account.name} comes from opening invoices, bills and credits. Enter those instead.`);
        if (account.code === OPENING_ADJUSTMENTS_CODE) throw new BadRequestException("Opening Balance Adjustments takes the difference. Leave it empty.");
      }

      if (row) {
        await tx.delete(openingBalanceLines).where(eq(openingBalanceLines.orgId, orgId));
      } else {
        await tx.insert(openingBalances).values({ orgId, cutoverDate: input.cutoverDate });
      }
      if (lines.length) await tx.insert(openingBalanceLines).values(lines.map((l) => ({ orgId, accountId: l.accountId, debit: l.debit, credit: l.credit })));

      // Re-post P17: reverse the old entry (on its own date), post the new one.
      if (row?.entryId) await this.ledger.reverseEntry(tx, row.entryId, { orgId, date: dayBefore(row.cutoverDate), narration: "Opening balances re-entered", sourceType: "opening_balance_repost", sourceId: row.entryId });
      const entryId = lines.length ? await this.postP17(tx, orgId, input.cutoverDate, lines) : null;
      await tx.update(openingBalances).set({ cutoverDate: input.cutoverDate, entryId, updatedAt: new Date() }).where(eq(openingBalances.orgId, orgId));
      if (row && row.cutoverDate !== input.cutoverDate) await this.redateDocuments(tx, orgId, input.cutoverDate);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "opening_balances",
        entityId: orgId,
        contactId: null,
        changes: { cutoverDate: input.cutoverDate, accounts: lines.length },
      });
    });
    return this.get(orgId);
  }

  /** P17: each entered balance, and the difference to 3900, dated the day before the cutover date. */
  private async postP17(tx: Transaction, orgId: string, cutoverDate: string, lines: { accountId: string; debit: bigint; credit: bigint }[]): Promise<string | null> {
    const posting: PostingLine[] = lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit }));
    const difference = lines.reduce((sum, l) => sum + l.debit - l.credit, 0n);
    if (difference !== 0n) {
      const adjustments = await this.ledger.resolveSystemAccount(tx, orgId, "openingBalanceAdjustments");
      posting.push({ accountId: adjustments, debit: difference < 0n ? -difference : 0n, credit: difference > 0n ? difference : 0n });
    }
    if (posting.filter((p) => p.debit > 0n || p.credit > 0n).length < 2) return null;
    return this.ledger.postEntry(tx, { orgId, date: dayBefore(cutoverDate), narration: "Opening balances", sourceType: "opening_balance", sourceId: randomUUID(), lines: posting });
  }

  /**
   * Nothing but opening entries may be dated before the cutover date: the
   * opening balances are the books on the day before it.
   */
  async requireNothingBefore(db: Database | Transaction, orgId: string, cutoverDate: string) {
    const [found] = await db
      .select({ n: sql<number>`count(distinct (${journalEntries.sourceType}, ${journalEntries.sourceId}))::int`, earliest: sql<string | null>`min(${journalEntries.date})` })
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, orgId), lt(journalEntries.date, cutoverDate), notLike(journalEntries.sourceType, "opening\\_%")));
    if (found && found.n > 0) {
      const { locale } = await orgMoneySettings(this.db, orgId);
      throw new BadRequestException(OPENING_DOCUMENTS_BEFORE(found.n, formatMessageDate(found.earliest!, locale)));
    }
  }

  /** Net (debit − credit) per account from opening documents' entries (`opening_` sources, P17 excepted). */
  async documentBalances(db: Database | Transaction, orgId: string): Promise<Map<string, bigint>> {
    const rows = await db
      .select({ accountId: journalLines.accountId, net: sql<string>`sum(${journalLines.debit} - ${journalLines.credit})` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalEntries.orgId, orgId), like(journalEntries.sourceType, "opening\\_%"), notLike(journalEntries.sourceType, "opening\\_balance%")))
      .groupBy(journalLines.accountId);
    return new Map(rows.map((r) => [r.accountId, BigInt(r.net)]));
  }

  async lockRow(tx: Transaction, orgId: string): Promise<OpeningRow | undefined> {
    const [row] = await tx.select().from(openingBalances).where(eq(openingBalances.orgId, orgId)).for("update");
    return row;
  }

  /**
   * US-RPT-19 — locks the opening balances: a closed fiscal period from the
   * earliest possible date to the day before the cutover date, so nothing
   * more is posted before it (I17), and every opening screen becomes
   * read-only. Unlocking reopens that same period. Both are audited.
   */
  async lock(orgId: string, actorUserId: string): Promise<OpeningBalancesView> {
    await this.db.transaction(async (tx) => {
      const row = await this.lockRow(tx, orgId);
      if (!row) throw new BadRequestException("Enter your opening balances before locking them.");
      if (row.status === "locked") throw new BadRequestException("The opening balances are already locked.");
      const endDate = dayBefore(row.cutoverDate);
      let periodId = row.fiscalPeriodId;
      if (periodId) {
        await tx.update(fiscalPeriods).set({ startDate: OPENING_PERIOD_START, endDate, isClosed: true }).where(eq(fiscalPeriods.id, periodId));
      } else {
        const [period] = await tx.insert(fiscalPeriods).values({ orgId, startDate: OPENING_PERIOD_START, endDate, isClosed: true }).returning();
        periodId = period!.id;
      }
      await tx.update(openingBalances).set({ status: "locked", lockedAt: new Date(), lockedByUserId: actorUserId, fiscalPeriodId: periodId, updatedAt: new Date() }).where(eq(openingBalances.orgId, orgId));
      const view = await this.get(orgId);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "locked", entityType: "opening_balances", entityId: orgId, contactId: null, changes: { cutoverDate: row.cutoverDate, openingBalanceAdjustments: view.adjustment } });
    });
    return this.get(orgId);
  }

  async unlock(orgId: string, actorUserId: string): Promise<OpeningBalancesView> {
    await this.db.transaction(async (tx) => {
      const row = await this.lockRow(tx, orgId);
      if (!row || row.status !== "locked") throw new BadRequestException("The opening balances aren't locked.");
      if (row.fiscalPeriodId) await tx.update(fiscalPeriods).set({ isClosed: false }).where(eq(fiscalPeriods.id, row.fiscalPeriodId));
      await tx.update(openingBalances).set({ status: "draft", lockedAt: null, lockedByUserId: null, updatedAt: new Date() }).where(eq(openingBalances.orgId, orgId));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "unlocked", entityType: "opening_balances", entityId: orgId, contactId: null, changes: { cutoverDate: row.cutoverDate } });
    });
    return this.get(orgId);
  }

  /** The opening balances row, created on first use; refused once locked (US-RPT-19). */
  async ensureDraft(tx: Transaction, orgId: string): Promise<OpeningRow> {
    let row = await this.lockRow(tx, orgId);
    if (!row) [row] = await tx.insert(openingBalances).values({ orgId, cutoverDate: await this.defaultCutover(orgId) }).returning();
    if (row!.status === "locked") throw new BadRequestException(OPENING_LOCKED);
    return row!;
  }

  /**
   * Opening documents' entries move with the cutover date: each is reversed
   * on its old date and posted again, unchanged, the day before the new one,
   * and the document points at the new entry.
   */
  private async redateDocuments(tx: Transaction, orgId: string, cutoverDate: string): Promise<void> {
    const live = await tx
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, orgId), inArray(journalEntries.sourceType, Object.keys(OPENING_DOCUMENT_POINTERS)), isNull(journalEntries.reversedById)));
    for (const entry of live) {
      const lines = await tx.select().from(journalLines).where(eq(journalLines.entryId, entry.id));
      await this.ledger.reverseEntry(tx, entry.id, { orgId, date: entry.date, narration: `${entry.narration ?? "Opening document"} (cutover date changed)`, sourceType: `${entry.sourceType}_repost`, sourceId: entry.sourceId });
      const newId = await this.ledger.postEntry(tx, {
        orgId,
        date: dayBefore(cutoverDate),
        narration: entry.narration,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        lines: lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, contactId: l.contactId, jobId: l.jobId })),
      });
      await OPENING_DOCUMENT_POINTERS[entry.sourceType]!(tx, entry.sourceId, newId);
    }
  }

  /** The start of the current financial year (Settings › Financial year), the first-time default. */
  private async defaultCutover(orgId: string): Promise<string> {
    const start = (await this.settings.get<{ month: number; day: number }>(orgId, "financial_year_start")) ?? { month: 1, day: 1 };
    const today = orgClock().date;
    const year = Number(today.slice(0, 4));
    const pad = (n: number) => String(n).padStart(2, "0");
    const thisYear = `${year}-${pad(start.month)}-${pad(start.day)}`;
    return thisYear <= today ? thisYear : `${year - 1}-${pad(start.month)}-${pad(start.day)}`;
  }
}
