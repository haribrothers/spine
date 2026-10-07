import { pgTable, uuid, text, bigint, timestamp, date, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { journalEntries } from "./ledger";
import { moneyAccounts } from "./banking";
import { creditNotes } from "./credit-notes";
import { paymentMethodEnum, payments } from "./payments";

/**
 * US-PAY-17 — money paid back to a customer out of their credit: an
 * unallocated payment or a credit note's excess (exactly one source).
 * Posts P23 (Dr 2200 Customer Advances / Cr the money account). The source
 * keeps the limit: `payments.refunded_amount` (checked against the
 * payment) or `credit_notes.credit_remaining_amount` (never negative).
 * Deleting posts the reversal and gives the credit back.
 */
export const customerRefunds = pgTable(
  "customer_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    sourcePaymentId: uuid("source_payment_id").references(() => payments.id),
    sourceCreditNoteId: uuid("source_credit_note_id").references(() => creditNotes.id),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    date: date("date").notNull(),
    method: paymentMethodEnum("method").notNull(),
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
    check("customer_refunds_positive", sql`${table.amount} > 0`),
    check("customer_refunds_one_source", sql`(${table.sourcePaymentId} IS NULL) <> (${table.sourceCreditNoteId} IS NULL)`),
    index("customer_refunds_contact_idx").on(table.orgId, table.contactId),
  ],
);
