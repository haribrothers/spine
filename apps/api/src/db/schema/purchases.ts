import { pgTable, uuid, text, bigint, integer, boolean, timestamp, date, pgEnum, index, check, numeric, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { catalogItems } from "./catalog";
import { jobs } from "./jobs";
import { taxRates, taxGroups } from "./tax";
import { accounts, journalEntries } from "./ledger";
import { files } from "./files";
import { moneyAccounts } from "./banking";
import { invoiceLines, recurringFrequencyEnum, recurringStatusEnum } from "./invoices";

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
    /** US-PUR-25 — vendor credits applied to this bill (P24a posts nothing); balance = total − paid − credited. */
    creditedAmount: bigint("credited_amount", { mode: "bigint" }).notNull().default(sql`0`),
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
    /** US-RPT-18 (D-137) — an unpaid bill brought in from the old system: no lines, posts P20. */
    isOpening: boolean("is_opening").notNull().default(false),
    /** US-PUR-30 (D-159) — the recurring bill and run date that created this bill; unique together, so a date is created once. */
    recurringBillId: uuid("recurring_bill_id").references((): AnyPgColumn => recurringBills.id, { onDelete: "set null" }),
    recurringRunOn: date("recurring_run_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vendor_bills_recurring_run_uidx").on(table.recurringBillId, table.recurringRunOn),
    index("vendor_bills_org_idx").on(table.orgId),
    index("vendor_bills_org_status_idx").on(table.orgId, table.status),
    index("vendor_bills_contact_idx").on(table.contactId),
    index("vendor_bills_job_idx").on(table.jobId),
    index("vendor_bills_org_demo_idx").on(table.orgId, table.isDemo),
    check("vendor_bills_paid_and_credited_within_total", sql`${table.amountPaid} + ${table.creditedAmount} <= ${table.totalAmount}`),
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
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    /** The Expense/COGS account this line's pre-tax amount debits at record() time — resolved from the catalog item's own expenseAccountId at add-time, then snapshotted; nullable only for heading/text lines. */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }),
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
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

export const recurringBillModeEnum = pgEnum("recurring_bill_mode", ["record", "draft"]);

/**
 * US-PUR-29–31 (D-159) — a recurring bill: the same schedule as a
 * recurring invoice (`recurring_invoices`) with vendor bill lines. The
 * 6:00 AM run (US-PUR-30) makes a bill for every date that has come, once
 * each and in order; "record" records it at once (P11), "draft" leaves it
 * for an Owner to check. `money_account_id` is the account it's usually
 * paid from, for reference. `next_run_on` is null while paused or finished.
 */
export const recurringBills = pgTable(
  "recurring_bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    frequency: recurringFrequencyEnum("frequency").notNull(),
    dayRule: text("day_rule").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    maxCount: integer("max_count"),
    createdCount: integer("created_count").notNull().default(0),
    dueDays: integer("due_days").notNull().default(14),
    moneyAccountId: uuid("money_account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    mode: recurringBillModeEnum("mode").notNull(),
    status: recurringStatusEnum("status").notNull().default("active"),
    nextRunOn: date("next_run_on", { mode: "string" }),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recurring_bills_org_idx").on(table.orgId), index("recurring_bills_next_run_idx").on(table.status, table.nextRunOn)],
);

/** A template line, the same shape as a vendor bill line; tax is worked out again on each run. */
export const recurringBillLines = pgTable(
  "recurring_bill_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recurringBillId: uuid("recurring_bill_id")
      .notNull()
      .references(() => recurringBills.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: vendorBillLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }),
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    isTaxInclusive: boolean("is_tax_inclusive").notNull().default(false),
  },
  (table) => [index("recurring_bill_lines_schedule_idx").on(table.recurringBillId, table.sortOrder)],
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
    /** US-BANK-03 (D-140) — the account it was paid from; the approver can change it before approving. */
    moneyAccountId: uuid("money_account_id").references(() => moneyAccounts.id, { onDelete: "restrict" }),
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
    /** US-PUR-23 (D-126) — "amount", or "labour" when entered as headcount × day rate (`expense_labour_lines`). */
    entryMode: text("entry_mode").notNull().default("amount"),
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

/**
 * US-PUR-23 (D-126) — a labour expense's rows: a trade, how many worked and
 * at what day rate. `line_amount` is headcount × day rate; the expense's
 * `amount` is their sum. No names, attendance or hours — Spine isn't a
 * payroll or timesheet system.
 */
export const expenseLabourLines = pgTable(
  "expense_labour_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    trade: text("trade").notNull(),
    headcount: integer("headcount").notNull(),
    dayRateAmount: bigint("day_rate_amount", { mode: "bigint" }).notNull(),
    lineAmount: bigint("line_amount", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("expense_labour_lines_expense_idx").on(table.expenseId, table.sortOrder), index("expense_labour_lines_org_trade_idx").on(table.orgId, table.trade)],
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
    /** US-BANK-03 (D-140) — the account the money came out of. */
    moneyAccountId: uuid("money_account_id").references(() => moneyAccounts.id, { onDelete: "restrict" }),
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

export const vendorCreditStatusEnum = pgEnum("vendor_credit_status", ["draft", "open", "used", "void"]);

/**
 * US-PUR-24 (D-141) — a vendor's credit note: returned goods, an
 * overcharge, a discount after the bill. Lines are shaped like a bill's.
 * Recording numbers it `VCR-` and posts P24 (Dr 2000 AP / Cr each line's
 * account and 1200 Input Tax, tagged with the job). `balance_amount` is
 * what's left to apply to bills or take as a refund; it never goes below
 * zero. Status: draft → open → used (balance 0), or void.
 */
export const vendorCredits = pgTable(
  "vendor_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    number: text("number"),
    /** The vendor's own credit note number. */
    vendorReference: text("vendor_reference"),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** "Against bill" — the bill whose lines it started from, if any. */
    billId: uuid("bill_id").references(() => vendorBills.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
    date: date("date", { mode: "date" }).notNull(),
    status: vendorCreditStatusEnum("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    balanceAmount: bigint("balance_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /** Brought in at the cutover date (US-RPT-18): no lines, posts P20 instead of P24. */
    isOpening: boolean("is_opening").notNull().default(false),
    notes: text("notes"),
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    entryId: uuid("entry_id").references(() => journalEntries.id),
    voidEntryId: uuid("void_entry_id").references(() => journalEntries.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("vendor_credits_balance_within_total", sql`${table.balanceAmount} >= 0 AND ${table.balanceAmount} <= ${table.totalAmount}`),
    index("vendor_credits_org_status_idx").on(table.orgId, table.status),
    index("vendor_credits_contact_idx").on(table.contactId),
  ],
);

/** US-PUR-24 — a vendor credit's lines, the same shape as `vendor_bill_lines`. */
export const vendorCreditLines = pgTable(
  "vendor_credit_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorCreditId: uuid("vendor_credit_id")
      .notNull()
      .references(() => vendorCredits.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: vendorBillLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }),
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    isTaxInclusive: boolean("is_tax_inclusive").notNull().default(false),
    lineSubtotalAmount: bigint("line_subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxAmount: bigint("line_tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalAmount: bigint("line_total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("vendor_credit_lines_credit_idx").on(table.vendorCreditId)],
);

/**
 * US-PUR-25 (D-141, P24a) — part of a vendor credit used against one of the
 * vendor's bills. Nothing posts: the credit and the bill both sit in 2000
 * AP for the vendor. A deferred trigger keeps allocations (and refunds,
 * US-PUR-26) within the credit, and payments plus credits within the bill.
 */
export const vendorCreditAllocations = pgTable(
  "vendor_credit_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    vendorCreditId: uuid("vendor_credit_id")
      .notNull()
      .references(() => vendorCredits.id),
    billId: uuid("bill_id")
      .notNull()
      .references(() => vendorBills.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("vendor_credit_allocations_positive", sql`${table.amount} > 0`),
    index("vendor_credit_allocations_credit_idx").on(table.vendorCreditId),
    index("vendor_credit_allocations_bill_idx").on(table.billId),
  ],
);

/**
 * US-PUR-26 (D-141) — money a vendor paid back against a credit. Posts P25
 * (Dr the money account / Cr 2000 AP) and lowers the credit's balance;
 * deleting posts the reversal and gives the balance back. The credit's
 * applications plus live refunds never exceed it (trigger, invariant 9).
 */
export const vendorRefunds = pgTable(
  "vendor_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    vendorCreditId: uuid("vendor_credit_id")
      .notNull()
      .references(() => vendorCredits.id),
    moneyAccountId: uuid("money_account_id")
      .notNull()
      .references(() => moneyAccounts.id),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    date: date("date", { mode: "date" }).notNull(),
    method: vendorPaymentMethodEnum("method").notNull(),
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
  (table) => [check("vendor_refunds_positive", sql`${table.amount} > 0`), index("vendor_refunds_credit_idx").on(table.vendorCreditId)],
);
