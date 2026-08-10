import { pgTable, uuid, text, bigint, real, integer, boolean, timestamp, date, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { catalogItems } from "./catalog";
import { files } from "./files";
import { quotes } from "./quotes";
import { journalEntries } from "./ledger";
import { jobs, milestones } from "./jobs";

/**
 * PRD F5 — Invoicing (Phase 2 · Money In). Stage 1 scope: standard invoice
 * CRUD, issue/void with ledger postings, PDF. Advances, credit notes, and
 * milestone/progress invoicing are later stages (see CHANGELOG) — this enum
 * and table are shaped so those slot in without a rework: `type` already
 * distinguishes `standard`/`advance`/`progress`, and `jobId`/`milestoneId`
 * are nullable now for exactly that reason, even though nothing sets them
 * yet (Jobs/milestones don't exist until Phase 3).
 *
 * `status` mirrors quotes.ts's own shape (draft -> issued, immutable once
 * issued) with two additions specific to invoices: `void` (S-05.8, a
 * one-way terminal state reached only from `issued`, posts a reversing
 * journal entry) and no "expired" concept (invoices don't expire — PRD's
 * overdue flagging, S-05.9, is computed from `dueDate` at read time,
 * exactly like quotes.ts computes `isExpired`, not stored here).
 */
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "void"]);

export const invoiceTypeEnum = pgEnum("invoice_type", ["standard", "advance", "progress"]);

/** Same three kinds as quoteLineTypeEnum — see quotes.ts's own comment on why one table covers priced items, section headings, and free text. */
export const invoiceLineTypeEnum = pgEnum("invoice_line_type", ["item", "heading", "text"]);

/** Mirrors quoteEmailStatusEnum exactly — see quotes.ts's own comment on the pending/sent/failed lifecycle. */
export const invoiceEmailStatusEnum = pgEnum("invoice_email_status", ["pending", "sent", "failed"]);

/**
 * An invoice (PRD F5). `number` is nullable, populated only by
 * `POST /invoices/:id/issue` (NumberingService, "invoice" document type),
 * inside the same transaction as the status flip and the ledger posting —
 * per CLAUDE.md, drafts have no number, numbers never change once assigned,
 * and the posting happens in the same transaction as the business document
 * that causes it.
 *
 * `sourceQuoteId` is nullable provenance only (S-03.10's "convert an
 * accepted quote into a job and its first invoice") — Stage 1 doesn't build
 * the conversion action itself yet (that's S-03.10, explicitly scoped to
 * later in Phase 2 per the PRD's phase breakdown), but the column exists now
 * so a from-quote invoice can record where it came from without a later
 * migration. Never re-read for pricing — every line snapshots its own
 * name/price/tax at creation time, exactly like quote_lines never re-reads
 * its catalog item.
 *
 * `jobId`/`milestoneId` are nullable and unused until Phase 3 (Jobs &
 * Construction Billing) — present now so Stage 1's shape doesn't need a
 * migration when progress invoicing lands.
 *
 * `retentionAmount` defaults to 0 — retention is a Phase 3 concern
 * (construction billing's milestone/retention model), but the posting rule
 * table (§7.2, "Invoice with retention: debit AR (net), Retention
 * Receivable; credit Revenue, Tax Payable") needs a place to record it once
 * that lands, and `LedgerService`'s invoice-issued posting already branches
 * on this column being nonzero so Stage 1's own zero-retention path and
 * Phase 3's later nonzero path share one code path instead of two.
 *
 * `amountPaid` is a denormalized running total, kept in sync by
 * `PaymentsService` (Payments Stage, not yet built) allocating against this
 * invoice — `0n` until then. Stored (not derived at read time from
 * `payment_allocations`) so "is this invoice fully paid" is a fast,
 * single-row check for AR aging and the receivables dashboard, matching
 * `quotes.totalAmount`'s own "server-computed, then persisted" precedent.
 *
 * `subtotalAmount`/`taxAmount`/`totalAmount` are always server-computed
 * from `invoice_lines` on every write, never trusted from the client — see
 * quotes.ts's identical comment on its own totals, and CLAUDE.md's money
 * rule.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Gapless, permanent, allocated only on issue — see NumberingService. Null on every draft. */
    number: text("number"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    type: invoiceTypeEnum("type").notNull().default("standard"),
    /** Provenance only (S-03.10) — see this table's own doc comment. Not yet settable in Stage 1 (no conversion action exists yet). */
    sourceQuoteId: uuid("source_quote_id").references(() => quotes.id, { onDelete: "set null" }),
    /** Phase 3 (Jobs) — set by MilestonesService.invoiceMilestone (S-04.5) for a `progress`-type invoice, and by JobsService for a retention-release final invoice (S-04.7). `set null` on job delete since a job is never actually deletable in practice (no delete path exists — see JobsService), but matches every other provenance FK's convention. */
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    /** Set only for a milestone-triggered progress invoice — see milestones.ts's own `invoicedInvoiceId` doc comment for the inverse pointer. */
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    issueDate: date("issue_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    currency: text("currency").notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /** Phase 3 concern — see this table's own doc comment. Always 0 until milestones/retention exist. */
    retentionAmount: bigint("retention_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /** Denormalized running total kept in sync by PaymentsService allocations — see this table's own doc comment. */
    amountPaid: bigint("amount_paid", { mode: "bigint" }).notNull().default(sql`0`),
    /**
     * S-05.6 — denormalized running total kept in sync by
     * CreditNotesService.issue, same "fast single-row check" reasoning as
     * `amountPaid`'s own comment. Kept as its own column rather than folded
     * into `amountPaid` — a credit note reduces what's owed without any
     * cash changing hands, which is a meaningfully different fact from "the
     * customer paid this" for future reporting (e.g. "total credited" as
     * its own metric), even though both currently feed the same
     * `balanceDue = totalAmount - amountPaid - creditedAmount` formula.
     */
    creditedAmount: bigint("credited_amount", { mode: "bigint" }).notNull().default(sql`0`),
    notes: text("notes"),
    termsAndConditions: text("terms_and_conditions"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Set once, in the same transaction as the status flip to `issued` — never touched again (an issued invoice is immutable). */
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    /** S-05.8 — set once by void(), alongside the status flip to `void`. Never cleared (void is one-way, per CLAUDE.md's "only voided or credited"). */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: text("voided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    /** The journal_entries row this invoice's issuance posted — set inside the same transaction as the status flip, never re-pointed. Nullable: null on every draft and on a failed-to-post issue (issuing must roll back the whole transaction if posting fails, per CLAUDE.md's "in the same transaction" rule, so in practice this is only ever null on a draft). */
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    /** S-05.8 — the reversing entry posted by void(), separate from journalEntryId (the original issue posting), so both remain independently visible in the ledger per CLAUDE.md's "corrections are reversing entries, never edits." */
    voidJournalEntryId: uuid("void_journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
    /** Same send-time PDF snapshot convention as quotes.pdfFileId — see quotes.ts's own doc comment. */
    pdfFileId: uuid("pdf_file_id").references(() => files.id, { onDelete: "set null" }),
    emailStatus: invoiceEmailStatusEnum("email_status"),
    emailError: text("email_error"),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    /** Same demo-data marker convention as quotes.isDemo — see contacts.ts's isDemo comment. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invoices_org_idx").on(table.orgId),
    index("invoices_org_status_idx").on(table.orgId, table.status),
    index("invoices_org_demo_idx").on(table.orgId, table.isDemo),
    index("invoices_contact_idx").on(table.contactId),
    index("invoices_source_quote_idx").on(table.sourceQuoteId),
    index("invoices_org_number_idx").on(table.orgId, table.number),
    index("invoices_org_due_date_idx").on(table.orgId, table.dueDate),
    index("invoices_job_idx").on(table.jobId),
    index("invoices_milestone_idx").on(table.milestoneId),
  ],
);

/**
 * A single invoice line — priced item, section heading, or free text.
 * Structurally identical to quote_lines (see quotes.ts's own doc comment
 * for the full reasoning on snapshotting, cascade-delete + full-replace,
 * and why quantity is `real` not bigint) — duplicated rather than shared
 * because the two tables' rows point at different parents (invoiceId vs
 * quoteId) and Drizzle has no clean way to share a table definition across
 * two different FKs without losing type safety on the parent column.
 */
export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: invoiceLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    quantity: real("quantity").notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    discountPercentage: real("discount_percentage").notNull().default(0),
    taxRatePercentage: real("tax_rate_percentage").notNull().default(0),
    lineSubtotalAmount: bigint("line_subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxAmount: bigint("line_tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalAmount: bigint("line_total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invoice_lines_invoice_idx").on(table.invoiceId),
    index("invoice_lines_catalog_item_idx").on(table.catalogItemId),
  ],
);
