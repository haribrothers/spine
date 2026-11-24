import { pgTable, pgEnum, uuid, text, bigint, integer, timestamp, date, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { accounts, journalEntries } from "./ledger";
import { jobs } from "./jobs";

export const manualJournalStatusEnum = pgEnum("manual_journal_status", ["posted", "reversed"]);

/**
 * US-RPT-20, US-RPT-21 (D-134) — an adjusting journal an Owner posts for
 * what no document covers (depreciation, accruals, year-end adjustments).
 * Numbered JNL, posted P21, never edited: a mistake is reversed.
 */
export const manualJournals = pgTable(
  "manual_journals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    date: date("date").notNull(),
    reason: text("reason").notNull(),
    status: manualJournalStatusEnum("status").notNull().default("posted"),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    reversalEntryId: uuid("reversal_entry_id").references(() => journalEntries.id),
    reversalDate: date("reversal_date"),
    reversalReason: text("reversal_reason"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedByUserId: text("reversed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("manual_journals_org_date_idx").on(table.orgId, table.date)],
);

/** One line of a manual journal; never a control account (I15). */
export const manualJournalLines = pgTable(
  "manual_journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => manualJournals.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    description: text("description"),
    debit: bigint("debit", { mode: "bigint" }).notNull().default(sql`0`),
    credit: bigint("credit", { mode: "bigint" }).notNull().default(sql`0`),
    jobId: uuid("job_id").references(() => jobs.id),
  },
  (table) => [
    check("manual_journal_lines_one_sided", sql`${table.debit} >= 0 AND ${table.credit} >= 0 AND (${table.debit} = 0) <> (${table.credit} = 0)`),
    index("manual_journal_lines_journal_idx").on(table.journalId),
  ],
);
