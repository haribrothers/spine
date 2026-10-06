import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { LEDGER_SOURCE_KINDS, type DayBookReport, type GeneralLedgerAccount, type GeneralLedgerReport } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, contacts, jobs, journalEntries, journalLines } from "../../db/schema";
import { LedgerSourcesService } from "./ledger-sources.service";

/**
 * US-RPT-24, US-RPT-25 — the accountant's reports, read straight from
 * `journal_lines`: the general ledger (each account's opening balance,
 * entries and closing balance) and the day book (every entry by date).
 * Balances are debit-positive; the page shows Dr/Cr.
 */
/**
 * Narrations repeat the source ("Payment RCP-0004 received", "Journal
 * JNL-0003 — Depreciation"); the Source column already says that, so the
 * description is only what follows " — " or ": " — the reason or detail.
 */
export function narrationDetail(narration: string | null): string | null {
  const match = narration?.match(/(?: — |: )(.+)$/s);
  return match?.[1]?.trim() || null;
}

@Injectable()
export class LedgerReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sources: LedgerSourcesService,
  ) {}

  async generalLedger(orgId: string, query: { from: string; to: string; accountIds: string[]; includeInactive: boolean; page: number; pageSize: number }): Promise<GeneralLedgerReport> {
    const chart = await this.db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), query.accountIds.length ? inArray(accounts.id, query.accountIds) : undefined))
      .orderBy(asc(accounts.code));
    const ids = chart.map((a) => a.id);
    if (!ids.length) return { from: query.from, to: query.to, accounts: [], page: query.page, pageSize: query.pageSize, totalAccounts: 0 };

    const active = await this.db
      .select({ accountId: journalLines.accountId, n: sql<number>`count(*)::int` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalEntries.orgId, orgId), inArray(journalLines.accountId, ids), gte(journalEntries.date, query.from), lte(journalEntries.date, query.to)))
      .groupBy(journalLines.accountId);
    const hasActivity = new Set(active.map((a) => a.accountId));
    const listed = query.includeInactive ? chart : chart.filter((a) => hasActivity.has(a.id));
    const pageAccounts = listed.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const pageIds = pageAccounts.map((a) => a.id);
    if (!pageIds.length) return { from: query.from, to: query.to, accounts: [], page: query.page, pageSize: query.pageSize, totalAccounts: listed.length };

    const openings = await this.db
      .select({ accountId: journalLines.accountId, net: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalEntries.orgId, orgId), inArray(journalLines.accountId, pageIds), lt(journalEntries.date, query.from)))
      .groupBy(journalLines.accountId);
    const openingOf = new Map(openings.map((o) => [o.accountId, BigInt(o.net)]));

    const lines = await this.db
      .select({ line: journalLines, entry: journalEntries, contactName: contacts.name, job: { id: jobs.id, name: jobs.name, number: jobs.number } })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .leftJoin(contacts, eq(contacts.id, journalLines.contactId))
      .leftJoin(jobs, eq(jobs.id, journalLines.jobId))
      .where(and(eq(journalEntries.orgId, orgId), inArray(journalLines.accountId, pageIds), gte(journalEntries.date, query.from), lte(journalEntries.date, query.to)))
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt), asc(journalLines.id));
    const labels = await this.sources.describe(orgId, lines.map((l) => l.entry));

    const result: GeneralLedgerAccount[] = pageAccounts.map((account) => {
      let balance = openingOf.get(account.id) ?? 0n;
      const opening = balance;
      const rows = lines
        .filter((l) => l.line.accountId === account.id)
        .map(({ line, entry, contactName, job }) => {
          balance += line.debit - line.credit;
          const source = labels.get(`${entry.sourceType}:${entry.sourceId}`)!;
          return {
            ...source,
            journalLineId: line.id,
            entryId: entry.id,
            date: entry.date,
            contact: line.contactId && contactName ? { id: line.contactId, name: contactName } : null,
            job: job?.id ? job : null,
            description: narrationDetail(entry.narration),
            debit: line.debit.toString(),
            credit: line.credit.toString(),
            balance: balance.toString(),
          };
        });
      return { account, openingBalance: opening.toString(), rows, closingBalance: balance.toString() };
    });
    return { from: query.from, to: query.to, accounts: result, page: query.page, pageSize: query.pageSize, totalAccounts: listed.length };
  }

  /** US-RPT-25 — every journal entry in the range, in date order, with its lines. */
  async dayBook(orgId: string, query: { from: string; to: string; sourceType?: string }): Promise<DayBookReport> {
    const types = query.sourceType ? (LEDGER_SOURCE_KINDS.find((k) => k.key === query.sourceType)?.types ?? []) : null;
    const entries = await this.db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, orgId), gte(journalEntries.date, query.from), lte(journalEntries.date, query.to), types ? inArray(journalEntries.sourceType, types) : undefined))
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt));
    if (!entries.length) return { from: query.from, to: query.to, entries: [] };
    const lines = await this.db
      .select({ line: journalLines, account: { id: accounts.id, code: accounts.code, name: accounts.name }, contactName: contacts.name })
      .from(journalLines)
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .leftJoin(contacts, eq(contacts.id, journalLines.contactId))
      .where(inArray(journalLines.entryId, entries.map((e) => e.id)))
      .orderBy(asc(journalLines.entryId), sql`${journalLines.debit} = 0`, asc(accounts.code));
    const labels = await this.sources.describe(orgId, entries);
    return {
      from: query.from,
      to: query.to,
      entries: entries.map((entry) => {
        const own = lines.filter((l) => l.line.entryId === entry.id);
        const withContact = own.find((l) => l.line.contactId && l.contactName);
        return {
          ...labels.get(`${entry.sourceType}:${entry.sourceId}`)!,
          entryId: entry.id,
          date: entry.date,
          narration: entry.narration,
          description: narrationDetail(entry.narration),
          contact: withContact ? { id: withContact.line.contactId!, name: withContact.contactName! } : null,
          lines: own.map((l) => ({ account: l.account, debit: l.line.debit.toString(), credit: l.line.credit.toString() })),
        };
      }),
    };
  }
}
