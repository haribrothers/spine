import { pgTable, pgEnum, uuid, text, bigint, timestamp, date, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { accounts, fiscalPeriods, journalEntries } from "./ledger";

export const openingBalanceStatusEnum = pgEnum("opening_balance_status", ["draft", "locked"]);

/**
 * US-RPT-16, US-RPT-19 (D-137) — an organisation's starting point in Spine:
 * the cutover date and whether the opening balances are locked. One row per
 * organisation. `entry_id` is the current P17 entry (re-posted on each save
 * while draft); locking closes `fiscal_period_id`, ending the day before
 * the cutover date.
 */
export const openingBalances = pgTable("opening_balances", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  cutoverDate: date("cutover_date").notNull(),
  status: openingBalanceStatusEnum("status").notNull().default("draft"),
  entryId: uuid("entry_id").references(() => journalEntries.id),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedByUserId: text("locked_by_user_id").references(() => user.id, { onDelete: "set null" }),
  fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriods.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** US-RPT-16 — one account's balance on the cutover date. Never 1100, 1150, 2000, 2200 or 3900 (I15): those come from opening documents or the difference. */
export const openingBalanceLines = pgTable(
  "opening_balance_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    debit: bigint("debit", { mode: "bigint" }).notNull().default(sql`0`),
    credit: bigint("credit", { mode: "bigint" }).notNull().default(sql`0`),
  },
  (table) => [
    uniqueIndex("opening_balance_lines_account_uidx").on(table.orgId, table.accountId),
    check("opening_balance_lines_one_sided", sql`${table.debit} >= 0 AND ${table.credit} >= 0 AND (${table.debit} = 0 OR ${table.credit} = 0) AND ${table.debit} + ${table.credit} > 0`),
  ],
);
