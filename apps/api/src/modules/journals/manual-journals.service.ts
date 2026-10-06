import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  JOURNAL_CONTROL_ACCOUNT,
  JOURNAL_CONTROL_CODES,
  JOURNAL_OUT_BY,
  formatMoney,
  type CreateManualJournalInput,
  type ManualJournal,
} from "@spine/shared";
import { orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, jobs, manualJournalLines, manualJournals, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { NumberingService } from "../numbering/numbering.service";

type JournalRow = typeof manualJournals.$inferSelect;

/**
 * US-RPT-20–US-RPT-22 (D-134) — adjusting journals. Posting checks the
 * lines balance and use no control account (I15), then posts P21 with the
 * next JNL number; the ledger refuses a date in a closed period. Journals
 * are never edited.
 */
@Injectable()
export class ManualJournalsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string): Promise<ManualJournal[]> {
    const rows = await this.db.select().from(manualJournals).where(eq(manualJournals.orgId, orgId)).orderBy(desc(manualJournals.date), desc(manualJournals.number));
    if (!rows.length) return [];
    const lines = await this.db.select({ journalId: manualJournalLines.journalId, debit: manualJournalLines.debit }).from(manualJournalLines).where(inArray(manualJournalLines.journalId, rows.map((r) => r.id)));
    const totals = new Map<string, bigint>();
    for (const l of lines) totals.set(l.journalId, (totals.get(l.journalId) ?? 0n) + l.debit);
    const names = await this.userNames(rows.flatMap((r) => [r.createdByUserId, r.reversedByUserId]));
    return rows.map((r) => this.toJournal(r, totals.get(r.id) ?? 0n, names));
  }

  async get(orgId: string, id: string): Promise<ManualJournal> {
    const [row] = await this.db.select().from(manualJournals).where(and(eq(manualJournals.orgId, orgId), eq(manualJournals.id, id)));
    if (!row) throw new NotFoundException("Journal not found");
    const lines = await this.db
      .select({ line: manualJournalLines, account: { id: accounts.id, code: accounts.code, name: accounts.name }, job: { id: jobs.id, name: jobs.name, number: jobs.number } })
      .from(manualJournalLines)
      .innerJoin(accounts, eq(accounts.id, manualJournalLines.accountId))
      .leftJoin(jobs, eq(jobs.id, manualJournalLines.jobId))
      .where(eq(manualJournalLines.journalId, id))
      .orderBy(asc(manualJournalLines.sortOrder));
    const names = await this.userNames([row.createdByUserId, row.reversedByUserId]);
    return {
      ...this.toJournal(row, lines.reduce((s, l) => s + l.line.debit, 0n), names),
      lines: lines.map((l) => ({
        id: l.line.id,
        account: l.account,
        description: l.line.description,
        debit: l.line.debit.toString(),
        credit: l.line.credit.toString(),
        job: l.job?.id ? l.job : null,
      })),
    };
  }

  async getHistory(orgId: string, id: string) {
    await this.get(orgId, id);
    return this.auditLog.listForEntity(orgId, "manual_journal", id);
  }

  async create(orgId: string, actorUserId: string, input: CreateManualJournalInput): Promise<ManualJournal> {
    const chart = await this.db.select().from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.id, [...new Set(input.lines.map((l) => l.accountId))])));
    const byId = new Map(chart.map((a) => [a.id, a]));
    for (const line of input.lines) {
      const account = byId.get(line.accountId);
      if (!account) throw new BadRequestException("That account isn't in your chart of accounts.");
      if ((JOURNAL_CONTROL_CODES as readonly string[]).includes(account.code)) throw new BadRequestException(JOURNAL_CONTROL_ACCOUNT(account.name));
    }
    const jobIds = [...new Set(input.lines.map((l) => l.jobId).filter((j): j is string => Boolean(j)))];
    if (jobIds.length) {
      const found = await this.db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), inArray(jobs.id, jobIds)));
      if (found.length !== jobIds.length) throw new BadRequestException("That job isn't in Spine.");
    }
    const debits = input.lines.reduce((s, l) => s + l.debit, 0n);
    const credits = input.lines.reduce((s, l) => s + l.credit, 0n);
    if (debits !== credits) {
      const { currency, locale } = await orgMoneySettings(this.db, orgId);
      const out = debits > credits ? debits - credits : credits - debits;
      throw new BadRequestException(JOURNAL_OUT_BY(formatMoney(out, currency, locale)));
    }

    const id = await this.db.transaction(async (tx) => {
      const id = randomUUID();
      const number = await this.numbering.allocateNumber(tx, orgId, "journal");
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: `Journal ${number} — ${input.reason}`,
        sourceType: "manual_journal",
        sourceId: id,
        lines: input.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit, jobId: l.jobId })),
      });
      await tx.insert(manualJournals).values({ id, orgId, number, date: input.date, reason: input.reason, entryId, createdByUserId: actorUserId });
      await tx.insert(manualJournalLines).values(input.lines.map((l, i) => ({ journalId: id, sortOrder: i, accountId: l.accountId, description: l.description, debit: l.debit, credit: l.credit, jobId: l.jobId })));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "manual_journal", entityId: id, contactId: null, changes: { number, date: input.date, reason: input.reason, total: debits.toString() } });
      return id;
    });
    return this.get(orgId, id);
  }

  private async userNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((i): i is string => Boolean(i)))];
    if (!unique.length) return new Map();
    const rows = await this.db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, unique));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toJournal(row: JournalRow, total: bigint, names: Map<string, string>): ManualJournal {
    const person = (id: string | null) => (id && names.has(id) ? { id, name: names.get(id)! } : null);
    return {
      id: row.id,
      number: row.number,
      date: row.date,
      reason: row.reason,
      status: row.status,
      total: total.toString(),
      postedBy: person(row.createdByUserId),
      createdAt: row.createdAt.toISOString(),
      reversal:
        row.status === "reversed" && row.reversalEntryId
          ? { date: row.reversalDate!, reason: row.reversalReason ?? "", by: person(row.reversedByUserId), entryId: row.reversalEntryId }
          : null,
    };
  }
}
