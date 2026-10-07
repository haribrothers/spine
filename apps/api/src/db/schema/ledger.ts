import { type AnyPgColumn, pgTable, uuid, text, bigint, timestamp, date, boolean, pgEnum, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization } from "./auth";
import { contacts } from "./contacts";
import { jobs } from "./jobs";
import { bankReconciliations } from "./banking";

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  parentId: uuid("parent_id"),
  /** System accounts (AR, AP, tax, retention, advances, retained earnings) cannot be deleted, per §14.2. */
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A balanced financial event. Immutable once written — corrections post a
 * reversing entry via `reversedById`, never an edit. Written in the same
 * DB transaction as the business document that caused it, per §6.3.
 *
 * `totalDebits`/`totalCredits` are denormalized sums of this entry's
 * `journal_lines`, kept in sync by the `sync_journal_entry_totals` trigger.
 * Balance (debits == credits) is enforced by a `CONSTRAINT TRIGGER ...
 * DEFERRABLE INITIALLY DEFERRED` in the migration SQL, not a plain CHECK —
 * a plain CHECK fires after every single-row INSERT, which would reject an
 * entry's first line before its second line lands. The deferred trigger
 * only validates at COMMIT, once every line for the entry has been written.
 */
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    narration: text("narration"),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    reversedById: uuid("reversed_by_id"),
    totalDebits: bigint("total_debits", { mode: "bigint" }).notNull().default(sql`0`),
    totalCredits: bigint("total_credits", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    index("journal_entries_org_date_idx").on(table.orgId, table.date),
  ],
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    debit: bigint("debit", { mode: "bigint" }).notNull().default(sql`0`),
    credit: bigint("credit", { mode: "bigint" }).notNull().default(sql`0`),
    /**
     * Optional — enables AR aging and job profitability to be derived from
     * the ledger, per §7.1. `onDelete: "restrict"` (not "cascade" or
     * "set null"): a contact referenced by ledger history is financial
     * record-keeping, and CLAUDE.md's "issued financial documents are
     * never edited or deleted" spirit extends to not letting a contact
     * silently vanish out from under posted journal lines. In practice
     * this is close to moot — contacts.ts uses soft-delete (archivedAt)
     * rather than hard delete for exactly this reason, so RESTRICT is a
     * defensive backstop, not the primary safeguard.
     */
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "restrict" }),
    /** Optional — same job-costing rationale as this column's own doc comment above, and same RESTRICT convention as contactId: a job referenced by posted ledger history must not silently vanish. */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    /**
     * US-BANK-10 (invariant 10) — the finished reconciliation that matched
     * this line; cleared on undo. The only column the immutability trigger
     * lets change. A reconciled line's document can't be voided or deleted.
     */
    reconciliationId: uuid("reconciliation_id").references((): AnyPgColumn => bankReconciliations.id),
  },
  (table) => [
    check("journal_lines_one_sided", sql`(${table.debit} = 0 OR ${table.credit} = 0) AND (${table.debit} > 0 OR ${table.credit} > 0)`),
    index("journal_lines_entry_idx").on(table.entryId),
    index("journal_lines_account_idx").on(table.accountId),
    index("journal_lines_contact_idx").on(table.contactId),
    index("journal_lines_job_idx").on(table.jobId),
    index("journal_lines_reconciliation_idx").on(table.reconciliationId),
  ],
);

export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});
