import { files } from "./files";
import { pgTable, uuid, text, bigint, integer, boolean, timestamp, date, pgEnum, index, numeric, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { catalogItems } from "./catalog";
import { invoiceLines, invoices } from "./invoices";
import { supplyClassEnum, supplyTypeEnum, taxGroups, taxRates } from "./tax";
import { journalEntries } from "./ledger";

/**
 * PRD F5 (S-05.6) — "issue a credit note against an invoice for a return or
 * correction, so I never edit an issued document." Structurally the
 * simplest of the three document types (quotes/invoices/credit notes) —
 * `draft -> issued` only, no void (there is no PRD story asking to undo a
 * credit note; a mistaken one is simply left as a small permanent
 * correction, matching Spine's "nothing financial is ever deleted"
 * rule literally rather than adding a reversal-of-a-reversal concept
 * nobody asked for).
 */
export const creditNoteStatusEnum = pgEnum("credit_note_status", ["draft", "issued"]);

/** Same three kinds as invoiceLineTypeEnum/quoteLineTypeEnum — see invoices.ts's own comment. */
export const creditNoteLineTypeEnum = pgEnum("credit_note_line_type", ["item", "heading", "text"]);

/**
 * A credit note (PRD F5/§7). Always tied to one specific `invoiceId` — the
 * PRD's own wording is "against an invoice," not a freestanding document,
 * so unlike quotes/invoices there is no contact-only path; `contactId` is
 * still stored directly (denormalized from the invoice) purely so listing/
 * filtering by contact doesn't need a join, matching payments.ts's own
 * contactId-on-every-row convention.
 *
 * `number` is nullable, populated only on issue (NumberingService,
 * "credit_note" document type) — same gapless-only-on-issue rule as every
 * other document type per the architecture rules.
 *
 * `subtotalAmount`/`taxAmount`/`totalAmount` are always server-computed
 * from `credit_note_lines`, never trusted from the client — identical
 * convention to invoices.ts/quotes.ts.
 */
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Gapless, permanent, allocated only on issue — see NumberingService. Null on every draft. */
    number: text("number"),
    status: creditNoteStatusEnum("status").notNull().default("draft"),
    reason: text("reason"),
    date: date("date", { mode: "date" }),
    currency: text("currency").notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /**
     * US-PAY-16 (D-142) — the part of the total that went beyond the
     * invoice's balance and is held as customer credit in 2200, less what's
     * since been applied to other invoices or refunded. Never negative.
     */
    creditRemainingAmount: bigint("credit_remaining_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Set once, in the same transaction as the status flip to `issued` — never touched again (an issued credit note is immutable, same as an issued invoice). */
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    /** The journal_entries row this credit note's issuance posted (§7.2 "Credit note issued": debit Revenue + Tax Payable, credit AR). Nullable: null on every draft. */
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    /** US-INV-17 (D-083) — the PDF rendered and stored once, at send/issue; every later download serves these exact bytes. Null on drafts and until the store-issued-pdf job (or the first download) stores it. */
    issuedPdfFileId: uuid("issued_pdf_file_id").references(() => files.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    /** US-TAX-13 — GST place of supply (state code, "96" other countries) and the supply type it gave; snapshotted with the document. */
    placeOfSupply: text("place_of_supply"),
    supplyType: supplyTypeEnum("supply_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_notes_org_idx").on(table.orgId),
    index("credit_notes_org_status_idx").on(table.orgId, table.status),
    index("credit_notes_invoice_idx").on(table.invoiceId),
    index("credit_notes_contact_idx").on(table.contactId),
    index("credit_notes_org_number_idx").on(table.orgId, table.number),
    check("credit_notes_credit_remaining_not_negative", sql`${table.creditRemainingAmount} >= 0`),
  ],
);

/**
 * US-PAY-16 — a credit note's spare credit applied to another invoice of
 * the same customer (P6: Dr 2200 Customer Advances / Cr 1100 AR). The
 * invoice's `credited_amount` rises by `amount`; the credit note's
 * `credit_remaining_amount` falls by it, never below zero.
 */
export const creditNoteAllocations = pgTable(
  "credit_note_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => journalEntries.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("credit_note_allocations_positive", sql`${table.amount} > 0`),
    index("credit_note_allocations_credit_note_idx").on(table.creditNoteId),
    index("credit_note_allocations_invoice_idx").on(table.invoiceId),
  ],
);

/**
 * A single credit note line — structurally identical to invoice_lines/
 * quote_lines (see invoices.ts's own doc comment for the full reasoning on
 * snapshotting, cascade-delete + full-replace, and why quantity is `real`
 * not bigint) — duplicated rather than shared for the same reason those two
 * are duplicated from each other.
 */
export const creditNoteLines = pgTable(
  "credit_note_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: creditNoteLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    /** US-TAX-11 — snapshot of why the line has (no) tax; null on heading and text lines. */
    supplyClass: supplyClassEnum("supply_class"),
    /** US-TAX-14 — HSN/SAC code, a snapshot from the item; null on heading and text lines. */
    hsnSac: text("hsn_sac"),
    /**
     * US-INV-36 (D-219) — the invoice line this credits; with its rate or
     * tax group copied from it, so the credit's tax is named and split by
     * component as on the invoice. Null on lines from before D-219.
     */
    invoiceLineId: uuid("invoice_line_id").references(() => invoiceLines.id, { onDelete: "set null" }),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    lineSubtotalAmount: bigint("line_subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxAmount: bigint("line_tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalAmount: bigint("line_total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credit_note_lines_credit_note_idx").on(table.creditNoteId),
    index("credit_note_lines_invoice_line_idx").on(table.invoiceLineId),
    index("credit_note_lines_catalog_item_idx").on(table.catalogItemId),
  ],
);
