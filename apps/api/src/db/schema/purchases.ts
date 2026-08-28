import { pgTable, uuid, text, bigint, real, integer, boolean, timestamp, date, pgEnum, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { catalogItems } from "./catalog";
import { jobs } from "./jobs";
import { taxRates, taxGroups } from "./tax";
import { accounts, journalEntries } from "./ledger";
import { files } from "./files";
import { invoiceLines } from "./invoices";

/**
 * PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — a vendor bill with
 * lines, tax and a due date (S-07.1). Structurally mirrors `invoices`/
 * `invoice_lines` (snapshot-on-write lines, draft-is-mutable/recorded-is-
 * immutable, same tax-rate/group FK + blended percentage shape from
 * FEAT-08) with one deliberate difference: `billNumber` is plain
 * user-entered text, NOT allocated via `NumberingService` — per that
 * module's own doc comment, "Vendor Bill is deliberately excluded: its
 * number is user-entered (the vendor's own number)." `status` has no
 * `sent`/`accepted` states like quotes — a bill only ever moves
 * `draft -> recorded` (the posting action, §7.2 "Vendor bill recorded") or
 * `draft -> void` (uncorrected mistake before posting). Once `recorded`, a
 * bill is immutable per CLAUDE.md; corrections are a fresh bill plus,
 * once payments exist against the wrong one, a manual adjustment outside
 * this module's v1 scope (no vendor credit-note story in FEAT-07).
 */
export const vendorBillStatusEnum = pgEnum("vendor_bill_status", ["draft", "recorded", "void"]);
export const vendorBillLineTypeEnum = pgEnum("vendor_bill_line_type", ["item", "heading", "text"]);

export const vendorBills = pgTable(
  "vendor_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Optional — S-07.5 job tagging, flows straight into journal_lines.jobId on posting so JobCostingService's existing cost-side query picks it up automatically. */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    status: vendorBillStatusEnum("status").notNull().default("draft"),
    /** Vendor-supplied identifier, never system-allocated — see this table's own doc comment. */
    billNumber: text("bill_number").notNull(),
    date: date("date", { mode: "date" }).notNull(),
    dueDate: date("due_date", { mode: "date" }),
    currency: text("currency").notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /** Denormalized running total, kept in sync by VendorPaymentsService on every allocation — never client-computed, same convention as invoices.amountPaid. */
    amountPaid: bigint("amount_paid", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: text("voided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    /** The journal_entries row posted at record() time — §7.2 "Vendor bill recorded". */
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    voidJournalEntryId: uuid("void_journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("vendor_bills_org_idx").on(table.orgId),
    index("vendor_bills_org_status_idx").on(table.orgId, table.status),
    index("vendor_bills_contact_idx").on(table.contactId),
    index("vendor_bills_job_idx").on(table.jobId),
    index("vendor_bills_org_demo_idx").on(table.orgId, table.isDemo),
  ],
);

/**
 * One line per expense/COGS category — `accountId` is required (unlike
 * catalog_items' optional income/expense account mapping) because a
 * vendor bill line has no other way to know which Expense/COGS account to
 * debit at posting time; a catalog item can supply a default via
 * `catalogItemId`'s provenance, but the line always snapshots its own
 * resolved `accountId`, never re-reading the catalog item later, per
 * CLAUDE.md's "documents snapshot their data" rule exactly like
 * invoice_lines/quote_lines already do for name/price/tax.
 */
export const vendorBillLines = pgTable(
  "vendor_bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => vendorBills.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: vendorBillLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: real("quantity").notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    /** The Expense/COGS account this line's pre-tax amount debits at record() time — resolved from the catalog item's own expenseAccountId at add-time, then snapshotted; nullable only for heading/text lines. */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }),
    taxRatePercentage: real("tax_rate_percentage").notNull().default(0),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    isTaxInclusive: boolean("is_tax_inclusive").notNull().default(false),
    lineSubtotalAmount: bigint("line_subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxAmount: bigint("line_tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalAmount: bigint("line_total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("vendor_bill_lines_bill_idx").on(table.billId),
    index("vendor_bill_lines_catalog_item_idx").on(table.catalogItemId),
    index("vendor_bill_lines_account_idx").on(table.accountId),
  ],
);

/**
 * S-09.9 half — org-configurable expense categories, each with a default
 * posting account (mirrors catalogItems.expenseAccountId's exact FK shape).
 * Free-standing (not derived from the chart of accounts directly) since a
 * category is a user-facing label ("Fuel", "Tools", "Site meals") that may
 * map to a shared or dedicated expense account — matches catalog.ts's own
 * "category is free-text, account mapping is a separate optional FK"
 * split, except here the category itself IS the table (no catalog item
 * involved) since a standalone expense has no catalogue provenance.
 */
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }),
    /** Own/others ownership split (PRD §9) — same nullable/never-reassigned pattern as contacts.createdByUserId. In practice most categories are set up during onboarding by the Primary Owner, so "own" resolves narrowly here — kept for consistency with every other resource in this pattern rather than a special-cased single capability. */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expense_categories_org_idx").on(table.orgId),
    index("expense_categories_account_idx").on(table.accountId),
    index("expense_categories_created_by_idx").on(table.createdByUserId),
  ],
);

/**
 * PRD FEAT-07 — a standalone expense (S-07.2/S-07.3 field submission,
 * S-07.4 approval gate). `status` is the actual posting trigger per the
 * PRD's own acceptance highlight: "an unapproved expense does not post to
 * the ledger. Approval is the posting trigger." — `journalEntryId` is only
 * ever set inside the SAME transaction as the `submitted -> approved`
 * status flip (ExpensesService.approve), never as a separate step, so
 * there is no reachable "approved but unposted" or "posted but rejected"
 * state.
 *
 * `paidBy` (PRD §7's own data-model wording: "paid_by") distinguishes who
 * fronted the money — `company` (paid from a business bank/cash account,
 * §7.2 "Expense paid directly": debit Expense, credit Bank/Cash) vs
 * `employee` (paid out of pocket, reimbursable — posts the same Expense
 * debit but credits a liability the org owes the submitter, modeled here
 * as Accounts Payable via the submitter's own contact record if one
 * exists, or simply left as a memo since v1 has no employee-reimbursement
 * ledger account; see ExpensesService.approve's own comment on the
 * simplification taken).
 *
 * `receiptFileId` is a single nullable FK directly on this table (not a
 * join table like job_photos) — an expense has exactly one receipt, not a
 * gallery, matching contacts.logoFileId's "one optional attachment" shape
 * rather than job_photos' one-to-many shape.
 *
 * `isBillable`/`billedOnInvoiceLineId` back S-07.6 — marking an expense
 * billable and later pulling it into a customer invoice line. Only an
 * approved (posted) expense can be marked billed, and only once — a
 * second attempt to bill the same expense is rejected, unlike quotes'
 * deliberately-unrestricted repeat-conversion (an expense reimbursed to a
 * customer twice would be a real financial error, not a legitimate staged-
 * billing use case).
 */
export const expenseStatusEnum = pgEnum("expense_status", ["submitted", "approved", "rejected"]);
export const expensePaidByEnum = pgEnum("expense_paid_by", ["company", "employee"]);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Gapless, permanent — allocated at approval time (an expense has no number while still submitted/rejected), via NumberingService's existing "expense" document type. */
    number: text("number"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    date: date("date", { mode: "date" }).notNull(),
    currency: text("currency").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    description: text("description"),
    paidBy: expensePaidByEnum("paid_by").notNull().default("company"),
    receiptFileId: uuid("receipt_file_id").references(() => files.id, { onDelete: "set null" }),
    status: expenseStatusEnum("status").notNull().default("submitted"),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedByUserId: text("rejected_by_user_id").references(() => user.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    /** Required on reject (S-07.4 "approve or reject ... with a comment"). Null while submitted/approved. */
    reviewComment: text("review_comment"),
    isBillable: boolean("is_billable").notNull().default(false),
    /** Set once this expense has been pulled into a customer invoice line (S-07.6) — see this table's own doc comment on why this is a one-shot action. */
    billedOnInvoiceLineId: uuid("billed_on_invoice_line_id").references(() => invoiceLines.id, { onDelete: "set null" }),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("expenses_amount_positive", sql`${table.amount} > 0`),
    index("expenses_org_idx").on(table.orgId),
    index("expenses_org_status_idx").on(table.orgId, table.status),
    index("expenses_category_idx").on(table.categoryId),
    index("expenses_job_idx").on(table.jobId),
    index("expenses_submitted_by_idx").on(table.submittedByUserId),
    index("expenses_org_demo_idx").on(table.orgId, table.isDemo),
  ],
);

/** PRD F6's own wording, reused verbatim for the vendor side per S-07.8. */
export const vendorPaymentMethodEnum = pgEnum("vendor_payment_method", ["cash", "bank_transfer", "cheque", "card", "upi", "other"]);

/**
 * S-07.8 — a payment made TO a vendor, allocated across their bills.
 * Structurally an exact mirror of `payments`/`payment_allocations` (see
 * those tables' own doc comments for the full reasoning — contact-scoped
 * not bill-scoped so a future "vendor overpayment held as credit"
 * extension has somewhere to live, immutable once created, no draft
 * state, denormalized `allocatedAmount` kept in sync by both application
 * code and `vendor_payment_allocations`' own DB trigger).
 */
export const vendorPayments = pgTable(
  "vendor_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Gapless, permanent — allocated at creation via NumberingService's "vendor_payment" document type (new, alongside the existing customer-side "receipt" type). */
    number: text("number"),
    date: date("date", { mode: "date" }).notNull(),
    method: vendorPaymentMethodEnum("method").notNull(),
    reference: text("reference"),
    currency: text("currency").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    allocatedAmount: bigint("allocated_amount", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** §7.2 "Vendor paid": debit Accounts Payable, credit Bank/Cash. */
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("vendor_payments_amount_positive", sql`${table.amount} > 0`),
    check("vendor_payments_allocated_not_negative", sql`${table.allocatedAmount} >= 0`),
    check("vendor_payments_allocated_not_over_amount", sql`${table.allocatedAmount} <= ${table.amount}`),
    index("vendor_payments_org_idx").on(table.orgId),
    index("vendor_payments_org_demo_idx").on(table.orgId, table.isDemo),
    index("vendor_payments_contact_idx").on(table.contactId),
    index("vendor_payments_org_number_idx").on(table.orgId, table.number),
  ],
);

/** One row per (vendor_payment, vendor_bill) allocation — exact structural mirror of `payment_allocations`, cross-row invariants enforced by a DB trigger (see the hand-written migration alongside this schema, mirroring 0020_payment_allocation_limits.sql). */
export const vendorPaymentAllocations = pgTable(
  "vendor_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    vendorPaymentId: uuid("vendor_payment_id")
      .notNull()
      .references(() => vendorPayments.id, { onDelete: "cascade" }),
    billId: uuid("bill_id")
      .notNull()
      .references(() => vendorBills.id, { onDelete: "restrict" }),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("vendor_payment_allocations_amount_positive", sql`${table.amount} > 0`),
    index("vendor_payment_allocations_payment_idx").on(table.vendorPaymentId),
    index("vendor_payment_allocations_bill_idx").on(table.billId),
    index("vendor_payment_allocations_org_idx").on(table.orgId),
  ],
);
