import { pgTable, uuid, text, bigint, integer, boolean, timestamp, date, pgEnum, index, numeric } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts, leads } from "./contacts";
import { catalogItems } from "./catalog";
import { files } from "./files";
import { taxRates, taxGroups, supplyClassEnum, supplyTypeEnum } from "./tax";

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
 * Phase 5 (Mobile) — how an accepted quote was actually accepted. Only
 * meaningful once `status === "accepted"`; both this and
 * `quotes.acceptedByUserId` stay null for a rejected or still-outstanding
 * quote. `"public_link"` is the existing, unauthenticated customer-facing
 * flow (`PublicQuotesService.accept`, no acting user); `"in_person"` is
 * `POST /quotes/:id/accept-in-person` — an authenticated Owner/Staff/Field
 * user inside the app captures the customer's signature on their own
 * device, on site. These are deliberately distinct code paths (see
 * QuotesService.acceptInPerson's own doc comment for why this isn't just
 * PublicQuotesService with a session bolted on) but both leave the quote in
 * the exact same terminal `accepted` state — this column is purely a
 * reportable fact about which channel resolved it, not a different
 * acceptance outcome.
 */
export const quoteAcceptanceMethodEnum = pgEnum("quote_acceptance_method", ["public_link", "in_person"]);

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
    /** US-QUO-30 — an optional name for the quote ("Bathroom refit — 2nd floor"), ≤ 120 characters; copied by duplicate and revise. */
    title: text("title"),
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
     * PRD F3 Stage 3 (S-03.6) — set once by the public accept/reject action,
     * alongside the `status` flip to `accepted`/`rejected`. Denormalized
     * onto the quote itself (duplicating what the corresponding
     * `quote_events` row already records) so the detail page and any future
     * report can read "when/what did the customer say" with a single-row
     * fetch instead of joining `quote_events`, exactly mirroring why
     * `discountRequiresApproval` is stored on the quote rather than always
     * re-derived — a fast, denormalized fact about the quote as it stands
     * today, with `quote_events` remaining the append-only source of truth
     * for the full history (multiple views, the eventual accept/reject).
     * Both null until a customer responds; never touched again afterward
     * (a resolved quote's response is as permanent as its own `sentAt`).
     */
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    responseComment: text("response_comment"),
    /** Phase 5 (Mobile, S-11.7) — see quoteAcceptanceMethodEnum's own doc comment above. Both null unless/until this quote is accepted via POST /quotes/:id/accept-in-person specifically (never set by the public-link accept path). */
    acceptanceMethod: quoteAcceptanceMethodEnum("acceptance_method"),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** US-QUO-19 (D-054) — what an on-site acceptance captured: the customer's signature (a PNG via `POST /files`) and the name they typed. Null for any other acceptance. */
    signatureFileId: uuid("signature_file_id").references(() => files.id, { onDelete: "set null" }),
    acceptedSignerName: text("accepted_signer_name"),
    /** US-INV-17 (D-083) — the PDF rendered and stored once, at send/issue; every later download serves these exact bytes. Null on drafts and until the store-issued-pdf job (or the first download) stores it. */
    issuedPdfFileId: uuid("issued_pdf_file_id").references(() => files.id, { onDelete: "set null" }),
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
    /** US-AI-06 (D-166) — saved from fields AI filled in. */
    aiAssisted: boolean("ai_assisted").notNull().default(false),
    /** US-TAX-13 — GST place of supply (state code, "96" other countries) and the supply type it gave; snapshotted with the document. */
    placeOfSupply: text("place_of_supply"),
    supplyType: supplyTypeEnum("supply_type"),
    /** US-CRM-26 (D-211) — the lead this quote was started from ("Create quote" on a won lead); same organisation and contact, checked in QuotesService. Revisions keep it. */
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quotes_org_idx").on(table.orgId),
    index("quotes_org_lead_idx").on(table.orgId, table.leadId),
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
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    unitPriceAmount: bigint("unit_price_amount", { mode: "bigint" }).notNull().default(sql`0`),
    unitPriceCurrency: text("unit_price_currency").notNull(),
    discountPercentage: numeric("discount_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    /**
     * Blended effective tax percentage for this line — always server-
     * computed from `taxRateId`/`taxGroupId` (FEAT-08) and stored so PDF/
     * display never re-reads the tax_rates/tax_groups tables. A line with
     * neither reference set (pre-FEAT-08 data, or "no tax" chosen
     * explicitly) has this at 0.
     */
    taxRatePercentage: numeric("tax_rate_percentage", { precision: 18, scale: 4, mode: "number" }).notNull().default(0),
    /** US-TAX-11 — snapshot of why the line has (no) tax; null on heading and text lines. */
    supplyClass: supplyClassEnum("supply_class"),
    /** US-TAX-14 — HSN/SAC code, a snapshot from the item; null on heading and text lines. */
    hsnSac: text("hsn_sac"),
    /** Provenance only, snapshot semantics — never re-read for totals. At most one of taxRateId/taxGroupId is set; enforced at the service layer. */
    taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
    taxGroupId: uuid("tax_group_id").references(() => taxGroups.id, { onDelete: "set null" }),
    /** Snapshot of the org's price-inclusive-of-tax setting (S-08.2) at the moment this line was priced — never re-read from org settings after. */
    isTaxInclusive: boolean("is_tax_inclusive").notNull().default(false),
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

/**
 * PRD F3 Stage 3 (S-03.5/S-03.6, §10.3) — backs the public, unauthenticated
 * "view this quote" link. Design: a stateless signed token (HMAC-SHA256 via
 * `jose`, keyed on `AUTH_SECRET`, encoding quoteId + this row's `nonce` +
 * an expiry claim — see `PublicQuoteTokenService`) PLUS this DB row, so a
 * token is both verifiable without a DB round-trip (fast path: signature +
 * expiry claim check) AND revocable early / auditable (this row: `revokedAt`
 * lets `revise()` void a superseded quote's outstanding link; `expiresAt`
 * here is the source of truth checked on every use, not just the JWT's own
 * `exp` claim, so revocation and "issue a new link with a shorter fuse"
 * both work without re-signing anything).
 *
 * Single-purpose (per §10.3's "signed, expiring, single-purpose tokens") is
 * read here as "scoped to exactly one quote" — NOT one-time-use. A customer
 * legitimately needs to open the emailed link, read the quote, maybe close
 * the tab and re-open it a few times before deciding (S-03.5's own wording:
 * "read the quote on my phone... so I don't need to download anything" —
 * nothing in S-03.5/S-03.6 implies a single viewing). Consuming the token
 * after one view would make the common "customer re-opens the email link a
 * day later to double check a number" case fail with a dead link, which is
 * worse UX than the token simply remaining valid until it naturally expires
 * or the quote is resolved (accepted/rejected/revised/re-sent). So this
 * token is reusable for GET (view) until `expiresAt`/`revokedAt`, and the
 * accept/reject actions themselves are what make it terminal in practice —
 * once the quote leaves `sent` status, `PublicQuotesService` rejects any
 * further use of any token for that quote regardless of this row's own
 * expiry, so there's no risk of a stale token re-triggering accept/reject.
 *
 * A fresh token+row is minted every time `send()` or a re-send happens; the
 * previous version's row (if the quote being sent is itself a revision) is
 * explicitly revoked by `revise()` — see quotes.service.ts.
 */
export const quotePublicTokens = pgTable(
  "quote_public_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The random nonce embedded in the signed JWT's own claims — looked up here on every request instead of trusting the JWT's claims alone, so revocation/expiry are enforced from durable state, not just what the token itself asserts. */
    nonce: text("nonce").notNull().unique(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Null while live. Set by `revise()` when a newer version supersedes this token's quote, and could be set by a future "resend" affordance to void a prior link — never unset once written. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_public_tokens_nonce_idx").on(table.nonce),
    index("quote_public_tokens_quote_idx").on(table.quoteId),
    index("quote_public_tokens_org_idx").on(table.orgId),
  ],
);

/** A quote_events row's kind — one per public, customer-facing interaction Stage 3 tracks. */
export const quoteEventTypeEnum = pgEnum("quote_event_type", ["viewed", "accepted", "rejected"]);

/**
 * PRD F3 Stage 3 (S-03.5/S-03.6/S-03.7) — one row per view/accept/reject on
 * the public link, in order. This is the append-only log the PRD's own
 * wording for these stories refers to as "view/accept/reject events"; it is
 * ALSO what "the moment a quote is viewed or accepted" (S-03.7) fires an
 * owner-notification email off of (`PublicQuotesService` writes a row here
 * and calls `NotificationsService` in the same request, not a separate
 * process reading this table later).
 *
 * `type: "viewed"` is recorded on EVERY successful public view, not only the
 * first — see the token's own reusable-until-resolved design above: since a
 * customer can legitimately view multiple times, each view is a real event
 * worth its own row for the owner's activity trail (a "viewed 3 times"
 * signal is more informative than deduplicating to one). The owner
 * NOTIFICATION for "viewed" is throttled, though — at most one per hour per
 * quote (`PublicQuotesService.VIEW_NOTIFICATION_THROTTLE_MS`) — a repeat
 * view within the window still gets its own row here, it just doesn't fire
 * a fresh email/in-app notification. This was a deliberately deferred
 * follow-up (see CHANGELOG) closed once real usage confirmed the
 * unconditional version was noisy in practice, per S-03.7's own "the moment
 * a quote is viewed" wording read as "notify promptly," not "notify on
 * every single request."
 *
 * `comment` is set only on `accepted`/`rejected` rows (S-03.6's "optional
 * comment"), always null on `viewed`. Quote-level resolution — `status`,
 * `respondedAt`, `responseComment` on `quotes` itself — is ALSO written by
 * the same accept/reject call (see quotes.ts's own comment on those
 * columns for why both the event row and the denormalized quote columns
 * exist side by side).
 */
export const quoteEvents = pgTable(
  "quote_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: quoteEventTypeEnum("type").notNull(),
    /** Optional accept/reject comment (S-03.6) — always null for `viewed`. */
    comment: text("comment"),
    /** Provenance for a public, unauthenticated action — useful for the audit trail and for spotting abuse; both nullable since a proxy or odd client could omit either. */
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_events_quote_idx").on(table.quoteId),
    index("quote_events_org_idx").on(table.orgId),
    index("quote_events_type_idx").on(table.type),
  ],
);
