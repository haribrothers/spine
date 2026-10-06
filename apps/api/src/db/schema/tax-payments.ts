import { pgTable, pgEnum, uuid, text, bigint, timestamp, date, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { journalEntries } from "./ledger";
import { moneyAccounts } from "./banking";

export const taxPaymentKindEnum = pgEnum("tax_payment_kind", ["payment", "refund"]);

/**
 * US-TAX-08 (D-143) — tax paid to the authority (P26: Dr 2100 paid + input
 * used / Cr 1200 input used, Cr the money account paid) or refunded by it
 * (P27: Dr the money account / Cr 1200). A payment covers a period; a
 * refund doesn't. Deleting posts the reversal and keeps the row.
 */
export const taxPayments = pgTable(
  "tax_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: taxPaymentKindEnum("kind").notNull(),
    periodFrom: date("period_from"),
    periodTo: date("period_to"),
    inputTaxUsed: bigint("input_tax_used", { mode: "bigint" }).notNull().default(sql`0`),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    moneyAccountId: uuid("money_account_id").references(() => moneyAccounts.id),
    date: date("date").notNull(),
    reference: text("reference"),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    reversalEntryId: uuid("reversal_entry_id").references(() => journalEntries.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("tax_payments_amounts", sql`${table.amount} >= 0 AND ${table.inputTaxUsed} >= 0 AND ${table.amount} + ${table.inputTaxUsed} > 0`),
    check(
      "tax_payments_kind_shape",
      sql`(${table.kind} = 'payment' AND ${table.periodFrom} IS NOT NULL AND ${table.periodTo} IS NOT NULL AND ${table.periodFrom} <= ${table.periodTo}) OR (${table.kind} = 'refund' AND ${table.inputTaxUsed} = 0 AND ${table.amount} > 0 AND ${table.moneyAccountId} IS NOT NULL)`,
    ),
    check("tax_payments_money_account", sql`${table.amount} = 0 OR ${table.moneyAccountId} IS NOT NULL`),
    index("tax_payments_org_date_idx").on(table.orgId, table.date),
  ],
);
