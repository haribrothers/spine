import { pgTable, uuid, text, bigint, real, integer, boolean, timestamp, date, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { catalogItems } from "./catalog";
import { files } from "./files";

/**
 * PRD F3 — quotes with multi-line pricing and versioning (S-03.1, S-03.8).
 * Stage 1 scope: data model + core CRUD + line items + versioning only — no
 * PDF, email, public link, view/accept/reject event tracking, or owner
 * notifications (those are Stage 2/3, see CHANGELOG). Org-scoped, following
 * contacts.ts/catalog.ts's own conventions exactly.
 *
 * `status` intentionally has NO "expired" member. A quote's validity is a
 * point-in-time comparison of `validUntil` against `now()`, not a state
 * transition triggered by any event — there's no cron job in Stage 1 (or
 * planned) to flip a stored status at midnight, and a stored "expired" value
 * could drift out of sync with `now()` between writes (e.g. a quote sent
 * with a past `validUntil` by mistake, or the org's clock/timezone). Instead
 * "expired" is computed at read time in QuotesService (`sent` AND
 * `validUntil < now()`), exactly as CLAUDE.md's guidance for S-03.11
 * describes. The stored enum only tracks real state transitions a user or
 * the system explicitly causes: draft -> sent -> accepted/rejected. A
 * revised-and-superseded quote stays `sent` in this column (its "superseded"
 * nature is derived by checking whether another quote's `parentQuoteId`
 * points back to it — see QuotesService.list/getOne), so this enum never
 * needs a "superseded" member either.
 */
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "sent", "accepted", "rejected"]);

/**
 * PRD S-03.2 — a quote line can be a priced item, a section heading, or a
 * free-text note, not only a priced item. `heading`/`text` lines carry only
 * `name`/`description` and zero out every money/qty/tax field rather than
 * using a separate table — one `quote_lines` table keeps ordering
 * (`sortOrder`) trivial across all three kinds instead of needing to merge-
 * sort two tables for display.
 */
export const quoteLineTypeEnum = pgEnum("quote_line_type", ["item", "heading", "text"]);

/**
 * PRD F3 Stage 2 (S-03.4) — surfaces the outcome of the queued send-email
 * job on the quote itself, so the detail page can answer "was the email
 * sent?" without anyone needing to inspect pg-boss's own job table
 * directly. `null` means no email has ever been attempted (every draft,
 * and briefly a freshly-sent quote before its queued job has run yet).
 * `pending` covers both "still queued" and "currently retrying" — the
 * detail page doesn't need to distinguish those, both read as "in
 * progress" to a user. `sent`/`failed` are terminal.
 */
export const quoteEmailStatusEnum = pgEnum("quote_email_status", ["pending", "sent", "failed"]);

/**
 * A quote (PRD F3). Versioning follows CLAUDE.md's "Key design decisions to
 * preserve": revising a SENT quote creates a new row with `parentQuoteId`
 * pointing at the prior version and `version` incremented, rather than
 * mutating the sent quote in place — the prior version's own row is never
 * edited, only its `status` may later reflect that a customer looked at a
 * stale copy (out of scope here; Stage 1 has no accept/reject on the public
 * side yet). A DRAFT quote, by contrast, IS mutable in place via `PUT
 * /quotes/:id` — it was never issued, so there is no history to preserve.
 *
 * `number` is nullable and populated only by `POST /quotes/:id/send`, which
 * allocates it from `number_sequences` (NumberingService) inside the same
 * transaction that flips status to `sent` — per CLAUDE.md, "drafts have no
 * number; numbers never change once assigned." A revision's new draft also
 * has `number: null` until it too is sent.
 *
 * `subtotalAmount`/`discountAmount`/`taxAmount`/`totalAmount` are always
 * server-computed from `quote_lines` on every write (create/update/
 * revise/send) — a client-supplied total is never trusted or stored
 * directly, per CLAUDE.md's money rule. They're persisted (not purely
 * derived at read time) so a sent quote's totals are a durable snapshot
 * even if tax math or line data were ever to change shape later, matching
 * the "documents snapshot their data" rule extended to computed fields.
 *
 * `discountRequiresApproval` is computed and stored at write time by
 * comparing the quote's overall discount percentage against the org's
 * discount-approval threshold (`SettingsService` key `discount_approval_
 * threshold`, mirroring `default_tax_rate`'s exact convention — see
 * QuotesService for the read-before-write check). Storing it (rather than
 * deriving it at every read from a threshold that could change later) keeps
 * "this quote needed approval" a fact about the quote as sent, matching the
 * document-snapshot rule: a later change to the org's threshold must never
 * retroactively change whether an already-sent quote needed approval.
 * `approvedByUserId`/`approvedAt` are set once by `POST
 * /quotes/:id/approve-discount` (owner-only, S-03.9) and never cleared.
 */
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Gapless, permanent, allocated only on send — see NumberingService. Null on every draft. */
    number: text("number"),
    status: quoteStatusEnum("status").notNull().default("draft"),
    /** Self-FK for versioning — null on a version-1 quote, set on every revision. */
    parentQuoteId: uuid("parent_quote_id"),
    version: integer("version").notNull().default(1),
    /** Plain date (no time-of-day) — "valid until end of this day" is the intended read, compared against `now()` at UTC-date granularity in QuotesService. */
    validUntil: date("valid_until", { mode: "date" }),
    currency: text("currency").notNull(),
    subtotalAmount: bigint("subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    discountAmount: bigint("discount_amount", { mode: "bigint" }).notNull().default(sql`0`),
    taxAmount: bigint("tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmount: bigint("total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    discountRequiresApproval: boolean("discount_requires_approval").notNull().default(false),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    termsAndConditions: text("terms_and_conditions"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Set once, in the same transaction as the status flip to `sent` — never touched again (a sent quote is immutable). */
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /**
     * PRD F3 Stage 2 (S-03.3/S-03.4) — the exact PDF generated at send time,
     * persisted via `FilesService` (S3/MinIO) rather than regenerated on
     * every download. Nullable: null on every draft (nothing to show yet —
     * the web UI instead calls `GET /quotes/:id/pdf` for a live preview,
     * which renders on demand from the current draft snapshot), and also
     * null on a sent quote if PDF generation/upload itself failed at send
     * time (send() must still succeed — number allocation is the
     * irreversible, must-not-fail step; PDF persistence failing is
     * logged, not fatal, matching the same graceful-degradation posture as
     * the email attempt). Once set, this is the permanent "PDF as emailed"
     * record for that quote version — a later PDF-template code change
     * must never alter what a `sent` quote's stored PDF looks like, per
     * CLAUDE.md's "documents snapshot their data" rule extended to
     * rendered output, not just row data.
     */
    pdfFileId: uuid("pdf_file_id").references(() => files.id, { onDelete: "set null" }),
    /**
     * Written by the queue worker (`quote-email.worker.ts`), not by
     * `send()` itself — `send()` only ever sets this to `pending` right
     * before enqueuing, so the detail page has an immediate, honest
     * "in progress" state to show rather than `null` (which would read as
     * "nothing is happening" during the window before the worker picks the
     * job up). The worker flips it to `sent` on success or `failed` (with
     * `emailError` set) once pg-boss's retries are exhausted — never
     * touched again after that, matching every other "terminal state" field
     * on this table.
     */
    emailStatus: quoteEmailStatusEnum("email_status"),
    /** Set only when emailStatus is `failed` — the last attempt's error message, for the detail page's "why" (e.g. "SMTP is not configured", "contact has no email address on file"). Cleared (set back to null) if a future retry path re-sends and succeeds. */
    emailError: text("email_error"),
    /** Set once, when the worker's SMTP send call actually succeeds — distinct from `sentAt` (which marks when the quote was ISSUED, not when the email was delivered; a send can succeed instantly then take minutes to actually deliver via a retried job). */
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    /** Same demo-data marker as contacts.isDemo/catalogItems.isDemo — see contacts.ts's isDemo comment. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quotes_org_idx").on(table.orgId),
    index("quotes_org_status_idx").on(table.orgId, table.status),
    index("quotes_org_demo_idx").on(table.orgId, table.isDemo),
    index("quotes_contact_idx").on(table.contactId),
    index("quotes_parent_idx").on(table.parentQuoteId),
    index("quotes_org_number_idx").on(table.orgId, table.number),
  ],
);

/**
 * A single quote line — priced item, section heading, or free text
 * (S-03.1/S-03.2). Cascades with its quote (a line has no independent
 * meaning once its quote is gone, and a quote's lines are only ever
 * replaced wholesale by QuotesService on update, not edited row-by-row from
 * the client, so cascade delete + full re-insert on every save is the
 * simplest correct model — mirrors how `quote_lines` never needs its own
 * archive/soft-delete state).
 *
 * `catalogItemId` is a nullable, `onDelete: set null` reference used ONLY
 * to remember provenance ("this line was added from catalog item X") for a
 * possible future "re-price from catalog" affordance — it is never
 * re-read at display or totals-computation time. Every money/tax/name field
 * below is a full snapshot taken at the moment the line was added or last
 * edited, per CLAUDE.md's "documents snapshot their data" rule: a later
 * price or tax-rate change on the catalog item must never alter this line.
 *
 * `quantity` is `real`, not bigint — a quantity (e.g. 2.5 hours) isn't
 * money, matching `catalog.ts`'s own precedent of using `real` for
 * non-money decimals (`defaultTaxRatePercentage`). `discountPercentage` is
 * percentage-only (0-100), not a fixed-amount override — simpler, and
 * consistent with how `defaultTaxRatePercentage` is itself a percentage;
 * a fixed-amount discount can be modeled later as a distinct feature if a
 * real need for it shows up, without touching this column's meaning.
 *
 * `lineTotalAmount` is computed server-side via `computeLineTax` on every
 * write and stored — never trusted from the client, never recomputed from
 * scratch at read time (so a past line's total is stable even if the tax
 * engine's rounding behavior were ever revisited).
 */
export const quoteLines = pgTable(
  "quote_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    type: quoteLineTypeEnum("type").notNull().default("item"),
    catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Zero for heading/text lines. */
    quantity: real("quantity").notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    discountPercentage: real("discount_percentage").notNull().default(0),
    taxRatePercentage: real("tax_rate_percentage").notNull().default(0),
    /** Post-discount, pre-tax subtotal for this line — stored so QuotesService can sum lines without recomputing discount math at read time. */
    lineSubtotalAmount: bigint("line_subtotal_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTaxAmount: bigint("line_tax_amount", { mode: "bigint" }).notNull().default(sql`0`),
    lineTotalAmount: bigint("line_total_amount", { mode: "bigint" }).notNull().default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_lines_quote_idx").on(table.quoteId),
    index("quote_lines_catalog_item_idx").on(table.catalogItemId),
  ],
);
