import { files } from "./files";
import { pgTable, uuid, text, bigint, timestamp, date, pgEnum, boolean, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { invoices } from "./invoices";
import { journalEntries } from "./ledger";
import { moneyAccounts } from "./banking";

/** PRD F6 (S-06.1's own wording: "cash, bank transfer, cheque, card, UPI and 'other'"). */
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "cheque", "card", "upi", "other"]);

/**
 * PRD F6 — Payments (Phase 2 · Money In). A payment is recorded against a
 * CONTACT, not directly against an invoice — §7's own data model
 * (`payments (contact_id, date, method, amount, reference)`) — because
 * S-06.4 requires recording a payment with no invoice yet at all (held as
 * unallocated customer credit). `payment_allocations` (below) is the only
 * place a payment is tied to specific invoices, and a payment can have
 * zero, one, or several allocation rows.
 *
 * Payments are immutable once created, same posture as invoices/quotes —
 * there is no "edit a payment" in Stage 1 (no PRD story asks for it); a
 * mis-recorded payment is corrected by deleting it (only if nothing has
 * been allocated from it yet — see PaymentsService.delete) or, once
 * something is allocated, left as a permanent record (matching
 * CLAUDE.md's "issued financial documents are never edited or deleted"
 * spirit extended to posted financial events generally). There is
 * deliberately no `status` column — a payment either exists (posted, with
 * a journal entry) or doesn't; there is no draft state for a payment,
 * unlike quotes/invoices, since PRD's S-06.1 wording ("record a payment")
 * describes a single atomic action, not a document with its own
 * draft-then-issue lifecycle.
 *
 * `allocatedAmount`/`unallocatedAmount` are denormalized running totals —
 * `unallocatedAmount = amount - allocatedAmount` is what S-06.4's "held as
 * customer credit" and a later payment's "apply remaining credit" flow
 * read, without summing `payment_allocations` on every request. Kept in
 * sync by `PaymentsService.allocate` inside the same transaction as each
 * new allocation row.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Gapless, permanent — allocated at creation time (a payment has no draft state, see this table's own doc comment), via NumberingService's "receipt" document type. */
    number: text("number"),
    /** US-INV-17 (D-083) — the PDF rendered and stored once, at send/issue; every later download serves these exact bytes. Null on drafts and until the store-issued-pdf job (or the first download) stores it. */
    issuedPdfFileId: uuid("issued_pdf_file_id").references(() => files.id, { onDelete: "set null" }),
    date: date("date", { mode: "date" }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: text("reference"),
    /** US-BANK-03 (D-140) — the account the money went into. */
    moneyAccountId: uuid("money_account_id").references(() => moneyAccounts.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    /** Denormalized running total of `payment_allocations.amount` for this payment — see this table's own doc comment. */
    allocatedAmount: bigint("allocated_amount", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** The journal_entries row this payment's creation posted (§7.2 "Payment received" if any amount was allocated to an invoice at creation time, or "Advance received" if fully unallocated — see PaymentsService.create's own comment on which rule applies and why a single payment can need both in one entry). */
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payments_amount_positive", sql`${table.amount} > 0`),
    check("payments_allocated_not_negative", sql`${table.allocatedAmount} >= 0`),
    check("payments_allocated_not_over_amount", sql`${table.allocatedAmount} <= ${table.amount}`),
    index("payments_org_idx").on(table.orgId),
    index("payments_org_demo_idx").on(table.orgId, table.isDemo),
    index("payments_contact_idx").on(table.contactId),
    index("payments_org_number_idx").on(table.orgId, table.number),
  ],
);

/**
 * S-06.2 — one row per (payment, invoice) allocation, letting a single
 * lump-sum payment settle several invoices, or a single invoice be
 * settled by several payments over time (both directions are just rows in
 * this table; neither side is denormalized to "one payment per invoice").
 *
 * PRD §6's own acceptance highlight for F6: "allocations can never exceed
 * either the payment amount or the invoice balance — enforced at the
 * database level, not just the UI." This table's own CHECK constraints
 * enforce `amount > 0` (a zero/negative allocation is nonsensical), but
 * the cross-row invariants ("sum of a payment's allocations <=
 * payments.amount" and "sum of an invoice's allocations <=
 * invoices.totalAmount") cannot be a plain per-row CHECK — they need a
 * trigger that re-sums on every insert, mirroring exactly how
 * `journal_lines`' own balance invariant needed a trigger rather than a
 * CHECK (see drizzle/0002_payment_allocation_limits.sql).
 */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("payment_allocations_amount_positive", sql`${table.amount} > 0`),
    index("payment_allocations_payment_idx").on(table.paymentId),
    index("payment_allocations_invoice_idx").on(table.invoiceId),
    index("payment_allocations_org_idx").on(table.orgId),
  ],
);
