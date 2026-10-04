import { pgTable, uuid, text, bigint, real, integer, boolean, timestamp, date, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { contacts } from "./contacts";
import { quotes } from "./quotes";
import { files } from "./files";

/**
 * PRD F4 (Phase 3 · Jobs & Construction Billing) — a job created from an
 * accepted quote (S-04.1), carrying the contract value over as a real
 * snapshot rather than a live reference back to the quote (per CLAUDE.md's
 * "documents snapshot their data" — a job must not silently change value if
 * its source quote were ever touched again). `sourceQuoteId` is kept purely
 * for provenance/navigation ("this job came from that quote"), mirroring
 * `invoices.sourceQuoteId`'s own `onDelete: set null` convention exactly.
 *
 * `status` starts at `active` (a job created from an accepted quote is,
 * definitionally, work about to start) and can be marked `on_hold` or
 * `completed`; `cancelled` covers a job that was created but never
 * proceeded. No "draft" state — unlike quotes/invoices a job isn't a
 * financial document requiring issue/void semantics; it's a container that
 * milestones/invoices/expenses attach to, so CLAUDE.md's numbering/
 * immutability rules don't apply to the job row itself (they apply to the
 * invoices it spawns).
 *
 * `retentionPct` is the org's/job's chosen retention percentage (S-04.6),
 * applied by InvoicesService when issuing a `progress`-type invoice against
 * this job — 0 means "no retention," the correct default for a
 * non-construction org (Construction's industry template sets a nonzero
 * default at job-creation time in the web UI, not here; this column has no
 * opinion about industry).
 */
export const jobStatusEnum = pgEnum("job_status", ["active", "on_hold", "completed", "cancelled"]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    /** Provenance only, per this table's own doc comment — never re-read for pricing. Null for a job created without a quote (not a path any story asks for yet, but the column doesn't force one to exist). */
    sourceQuoteId: uuid("source_quote_id").references(() => quotes.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    siteAddress: text("site_address"),
    status: jobStatusEnum("status").notNull().default("active"),
    startDate: date("start_date", { mode: "date" }),
    endDate: date("end_date", { mode: "date" }),
    currency: text("currency").notNull(),
    /** Snapshot of the accepted quote's total at job-creation time (S-04.1) — never recomputed from the quote afterward. Variation orders (S-04.9) adjust this explicitly when accepted, see VariationOrdersService. */
    contractValueAmount: bigint("contract_value_amount", { mode: "bigint" }).notNull().default(sql`0`),
    /** 0-100. See this table's own doc comment for why 0 is a safe default across every industry template. */
    retentionPct: real("retention_pct").notNull().default(0),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Same demo-data marker convention as contacts.isDemo/quotes.isDemo. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jobs_org_idx").on(table.orgId),
    index("jobs_org_status_idx").on(table.orgId, table.status),
    index("jobs_org_demo_idx").on(table.orgId, table.isDemo),
    index("jobs_contact_idx").on(table.contactId),
    index("jobs_source_quote_idx").on(table.sourceQuoteId),
  ],
);

/**
 * A billing milestone (S-04.2) — fixed amount or a percentage of the job's
 * `contractValueAmount`, resolved to a concrete amount at milestone-create/
 * update time (`resolvedAmount`, computed server-side exactly like every
 * other money field in this codebase — never trusted from the client) so
 * `MilestonesService`'s 100%-total validation (S-04.3) and progress-invoice
 * creation (S-04.5) both read one already-resolved bigint rather than
 * re-deriving it from `amountType`/`amount` on every use.
 *
 * `status` mirrors the story's own language: `pending` (not started) ->
 * `completed` (S-04.4, field user marks done with photos) -> `invoiced`
 * (S-04.5, a progress invoice has been raised from it — set the moment
 * that invoice is created, not when it's issued, since "raised" per
 * S-04.5's wording means the invoice now exists as a real draft/issued
 * document tied to this milestone, matching how a milestone shouldn't be
 * raised against twice). `invoicedInvoiceId` is nullable and only ever
 * set once — a milestone is a one-shot billing trigger, not something a
 * second invoice can be raised from after the first (S-04.5's own wording,
 * "raise a progress invoice FROM a completed milestone," reads as a single
 * action per milestone, matching how a quote's own accept/send actions are
 * similarly one-directional state transitions).
 */
export const milestoneAmountTypeEnum = pgEnum("milestone_amount_type", ["fixed", "percent"]);
export const milestoneStatusEnum = pgEnum("milestone_status", ["pending", "completed", "invoiced"]);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull().default(0),
    amountType: milestoneAmountTypeEnum("amount_type").notNull().default("percent"),
    /** For `amountType: "percent"`, 0-100 stored as a real (matching quote_lines.discountPercentage's own precedent). For `amountType: "fixed"`, the literal minor-units amount — same column reused rather than two nullable columns, since exactly one of amount/resolvedAmount interpretation applies depending on amountType. */
    amount: real("amount").notNull().default(0),
    /** Server-computed minor-units amount this milestone bills for — see this table's own doc comment. Recomputed whenever `amount`/`amountType` change or the job's `contractValueAmount` changes (MilestonesService.recomputeResolvedAmounts). */
    resolvedAmount: bigint("resolved_amount", { mode: "bigint" }).notNull().default(sql`0`),
    status: milestoneStatusEnum("status").notNull().default("pending"),
    dueDate: date("due_date", { mode: "date" }),
    /** Whoever last replaced the job's milestone set via `PUT /:id/milestones` (MilestonesService.setAll) — this is what "own" means for `milestones.edit_own`/`edit_others`, not who completes the milestone. Field always passes both own and others when completing (see FIELD_ALWAYS_CAPABILITIES), so this column never gates completion. */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Set by S-04.4 (field user marks complete) — who and when, for the office's own "ready to bill" view. */
    completedByUserId: text("completed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionNotes: text("completion_notes"),
    /** Set once by MilestonesService.invoiceMilestone (S-04.5) — see this table's own doc comment on `status`. */
    invoicedInvoiceId: uuid("invoiced_invoice_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("milestones_job_idx").on(table.jobId),
    index("milestones_org_idx").on(table.orgId),
    index("milestones_org_status_idx").on(table.orgId, table.status),
  ],
);

/**
 * S-04.4/S-04.10 — a photo tagged to a job (progress/condition record) or,
 * optionally, to one specific milestone (a completion photo). Reuses
 * `files` for the stored bytes per Files' own "plain nullable FK
 * per consumer, not polymorphic" convention (see files.ts's doc comment) —
 * this table is the job-specific association + caption, not a duplicate
 * upload mechanism.
 */
export const jobPhotos = pgTable(
  "job_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Null when the photo is a general job/site photo rather than tied to one milestone's completion (S-04.4 vs S-04.10 — the same table serves both, distinguished by this column). */
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    caption: text("caption"),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Same value as uploadedByUserId, duplicated under the standard `createdByUserId` name so `job_photos.edit_own`/`edit_others` ownership checks use the same column name every other own/others module uses. */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_photos_job_idx").on(table.jobId),
    index("job_photos_org_idx").on(table.orgId),
    index("job_photos_milestone_idx").on(table.milestoneId),
  ],
);

/** A free-text note on a job's timeline — site conditions, a call with the customer, anything not tied to a specific photo. Simple append-only log, same shape as job_photos minus the file. */
export const jobNotes = pgTable(
  "job_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("job_notes_job_idx").on(table.jobId), index("job_notes_org_idx").on(table.orgId)],
);

/**
 * Phase 5 (Mobile) — which field users are assigned to a job, backing
 * S-11.2's "today's assigned jobs" home-screen query. A join table rather
 * than a single `jobs.assignedToUserId` column (unlike `contacts.
 * assignedToUserId`'s single-pipeline-rep shape) because a field-service
 * job commonly has a crew, not one owner. Assigning/unassigning is its own
 * workflow action (`jobs.assign` capability, owner/staff only) — not part
 * of `jobs.edit_own`/`edit_others`, since "can I edit this job's fields"
 * and "can I decide who's on the crew" are different questions an Owner
 * may want to grant separately, matching every other dedicated
 * workflow-action capability in this codebase (see permissions.ts).
 */
export const jobAssignments = pgTable(
  "job_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_assignments_job_idx").on(table.jobId),
    index("job_assignments_user_idx").on(table.userId),
    index("job_assignments_org_idx").on(table.orgId),
    uniqueIndex("job_assignments_job_user_uidx").on(table.jobId, table.userId),
  ],
);

/**
 * S-04.9 — a variation order is modeled as a supplementary quote linked to
 * a job, per the story's own wording ("raise a variation order as a
 * supplementary quote linked to the job"), NOT a new document type. This
 * join table is the "linked to the job" half: `quotes.jobId` doesn't exist
 * on the quotes table itself (quotes predate Jobs and are usable with zero
 * job linkage in the common case), so a lightweight association table here
 * keeps Quotes' own schema untouched while giving Jobs a queryable list of
 * "variation quotes raised against me." When a variation quote is accepted,
 * its total is added to the job's `contractValueAmount` (VariationOrdersService,
 * Stage 3) — the same snapshot-on-accept model S-04.1 already uses for the
 * job's initial creation.
 */
export const jobVariationOrders = pgTable(
  "job_variation_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Set once, when this variation's quote is accepted and its value is folded into the job's contract value — never touched again (matching every other one-shot "applied" timestamp in this codebase, e.g. quotes.respondedAt). */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_variation_orders_job_idx").on(table.jobId),
    index("job_variation_orders_quote_idx").on(table.quoteId),
    index("job_variation_orders_org_idx").on(table.orgId),
  ],
);
