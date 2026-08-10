import { BadRequestException, Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, journalEntries, journalLines } from "../../db/schema";
import { PeriodsService } from "./periods.service";

/**
 * PRD §7.2 posting rules reference system accounts by name/role, not a
 * fixed id — every org gets its own copy of `DEFAULT_CHART_OF_ACCOUNTS`
 * (db/seed/chart-of-accounts.ts) seeded with these exact codes, so any
 * domain service can resolve "the AR account for this org" by code without
 * hardcoding an id. Matches the seed file's own codes exactly.
 */
export const SYSTEM_ACCOUNT_CODES = {
  accountsReceivable: "1100",
  retentionReceivable: "1150",
  inputTaxReceivable: "1200",
  accountsPayable: "2000",
  outputTaxPayable: "2100",
  customerAdvances: "2200",
} as const;

export type SystemAccountKey = keyof typeof SYSTEM_ACCOUNT_CODES;

/** One side of a balanced entry — exactly one of debit/credit must be nonzero, matching journal_lines' own `journal_lines_one_sided` CHECK constraint. */
export interface PostingLine {
  accountId: string;
  debit: bigint;
  credit: bigint;
  contactId?: string | null;
  jobId?: string | null;
}

export interface PostEntryInput {
  orgId: string;
  date: Date | string;
  narration?: string | null;
  sourceType: string;
  sourceId: string;
  lines: PostingLine[];
}

/**
 * The one place that writes `journal_entries`/`journal_lines` — every
 * domain module (Invoices, Payments, and later Purchases/Expenses) posts
 * through this service rather than inserting rows itself, per CLAUDE.md's
 * "posting rules live in one module" rule. `postEntry` does NOT open its
 * own transaction — callers always pass the same open `tx` as the business
 * document write that caused the posting (e.g. InvoicesService.issue's own
 * transaction), per CLAUDE.md's "in the same transaction as the business
 * document it originates from." The DB's own deferred constraint trigger
 * (drizzle/0001_ledger_integrity_triggers.sql) is the actual enforcement of
 * "debits == credits" — this method's own balance check is a fast, early,
 * app-level rejection with a clearer error message, not a substitute for it.
 */
@Injectable()
export class LedgerService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly periodsService: PeriodsService,
  ) {}

  /**
   * Resolves this org's system accounts by their well-known codes
   * (`SYSTEM_ACCOUNT_CODES`) in one query. Throws if any requested account
   * is missing — every org gets these seeded at creation
   * (`seedChartOfAccounts`), so a miss here means the org's chart of
   * accounts is corrupt/incomplete, not a normal "not configured yet" case
   * a caller should degrade gracefully around; posting must not silently
   * skip a leg of a balanced entry for a missing account.
   */
  async resolveSystemAccounts(
    orgIdOrTx: Database | Transaction,
    orgId: string,
    keys: SystemAccountKey[],
  ): Promise<Record<SystemAccountKey, string>> {
    const db = orgIdOrTx;
    const codes = keys.map((key) => SYSTEM_ACCOUNT_CODES[key]);
    const rows = await db
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), inArray(accounts.code, codes)));

    const byCode = new Map(rows.map((row) => [row.code, row.id]));
    const result = {} as Record<SystemAccountKey, string>;
    for (const key of keys) {
      const code = SYSTEM_ACCOUNT_CODES[key];
      const id = byCode.get(code);
      if (!id) {
        throw new InternalServerErrorException(
          `Chart of accounts is missing system account ${code} (${key}) for this organisation`,
        );
      }
      result[key] = id;
    }
    return result;
  }

  /** Convenience for a single system account, when a caller only needs one. */
  async resolveSystemAccount(db: Database | Transaction, orgId: string, key: SystemAccountKey): Promise<string> {
    const result = await this.resolveSystemAccounts(db, orgId, [key]);
    return result[key];
  }

  /**
   * Posts one balanced journal entry. Must be called with `tx` being the
   * same open transaction as the business-document write it originates
   * from — see this class's own doc comment. Returns the new entry's id so
   * the caller can store it (e.g. `invoices.journalEntryId`).
   */
  async postEntry(tx: Transaction, input: PostEntryInput): Promise<string> {
    const nonZeroLines = input.lines.filter((line) => line.debit > 0n || line.credit > 0n);
    if (nonZeroLines.length < 2) {
      throw new InternalServerErrorException(
        `Refusing to post journal entry for ${input.sourceType}:${input.sourceId} — fewer than two non-zero lines`,
      );
    }

    const totalDebits = nonZeroLines.reduce((sum, line) => sum + line.debit, 0n);
    const totalCredits = nonZeroLines.reduce((sum, line) => sum + line.credit, 0n);
    if (totalDebits !== totalCredits) {
      throw new InternalServerErrorException(
        `Refusing to post unbalanced journal entry for ${input.sourceType}:${input.sourceId} — debits ${totalDebits} != credits ${totalCredits}`,
      );
    }

    const dateStr = typeof input.date === "string" ? input.date : input.date.toISOString().slice(0, 10);

    // S-09.8 — "nobody back-dates entries into a closed period." Checked
    // inside the same transaction as the posting itself, using `tx` (not
    // `this.db`), so a period closed concurrently mid-transaction is still
    // caught rather than racing the write. Note every domain service today
    // posts with `date: new Date()` (issue/record/approve time, not a
    // user-editable backdate field) — so in practice this guard blocks
    // "post anything new while today falls in a closed range" rather than
    // literally rejecting a chosen past date, but it satisfies the same
    // intent: once a period is closed, no new activity can land inside
    // that date range either.
    if (await this.periodsService.isDateClosed(tx, input.orgId, dateStr)) {
      throw new BadRequestException(
        `Cannot post a journal entry dated ${dateStr} — that date falls within a closed fiscal period`,
      );
    }

    const [entry] = await tx
      .insert(journalEntries)
      .values({
        orgId: input.orgId,
        date: dateStr,
        narration: input.narration ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      })
      .returning();

    await tx.insert(journalLines).values(
      nonZeroLines.map((line) => ({
        entryId: entry!.id,
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        contactId: line.contactId ?? null,
        jobId: line.jobId ?? null,
      })),
    );

    return entry!.id;
  }

  /**
   * S-05.8 / CLAUDE.md "corrections are reversing entries, never edits" —
   * posts a mirror-image entry for every line of `originalEntryId` (debit
   * and credit swapped) with a fresh `sourceType`/`sourceId` and links the
   * original via `journal_entries.reversedById`. The original entry's own
   * rows are never touched (the DB's immutability triggers would reject an
   * UPDATE/DELETE on committed journal_lines anyway — this is the
   * correct, intended path, not a workaround for that guard).
   */
  async reverseEntry(
    tx: Transaction,
    originalEntryId: string,
    reversal: { orgId: string; date: Date | string; narration?: string | null; sourceType: string; sourceId: string },
  ): Promise<string> {
    const originalLines = await tx.select().from(journalLines).where(eq(journalLines.entryId, originalEntryId));
    if (!originalLines.length) {
      throw new InternalServerErrorException(`Cannot reverse journal entry ${originalEntryId} — it has no lines`);
    }

    const reversedEntryId = await this.postEntry(tx, {
      orgId: reversal.orgId,
      date: reversal.date,
      narration: reversal.narration,
      sourceType: reversal.sourceType,
      sourceId: reversal.sourceId,
      lines: originalLines.map((line) => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
        contactId: line.contactId,
        jobId: line.jobId,
      })),
    });

    await tx.update(journalEntries).set({ reversedById: reversedEntryId }).where(eq(journalEntries.id, originalEntryId));

    return reversedEntryId;
  }
}
