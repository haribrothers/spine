import { pgTable, uuid, text, boolean, bigint, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";
import { files } from "./files";

/**
 * Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as
 * customer, vendor or both"). Modeled as a fixed enum rather than two
 * booleans since exactly these three states are meaningful and a pg enum
 * matches the existing `accountTypeEnum` pattern in ./ledger.ts.
 */
export const contactTypeEnum = pgEnum("contact_type", ["customer", "vendor", "both"]);

/**
 * A company or an individual. Org-scoped. `email`/`phone` live directly on
 * the contact (not only via contact_persons) because an individual contact
 * — a sole trader, a homeowner customer — has no separate "person": the
 * contact IS the person. A company contact typically leaves these blank
 * and relies on `contact_persons` instead, but nothing enforces that; it's
 * a UI convention, not a DB constraint.
 *
 * Soft-delete via `archivedAt` rather than hard delete: per PRD §9
 * acceptance highlights ("Deleting a contact with financial documents is
 * blocked; deactivation is offered instead") and CLAUDE.md's "issued
 * financial documents are never edited or deleted" spirit — a contact can
 * be referenced by `journal_lines.contact_id` (AR aging, job profitability
 * pull from the ledger by contact), so once any ledger history exists for
 * a contact, hard-deleting the row would either cascade-destroy that
 * history or leave a dangling FK. Archiving (hide from active lists, keep
 * the row and every reference intact) is the only safe universal behavior,
 * so this pass implements archive/restore instead of delete for all
 * contacts, not just ones with ledger history — simpler and consistent
 * rather than branching behavior on "does this contact have documents yet."
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: contactTypeEnum("type").notNull(),
    isCompany: boolean("is_company").notNull().default(false),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    /**
     * Targeted field additions (task brief Phase 4 — explicitly NOT a full
     * Odoo/Zoho field clone). `taxId` is genuinely useful for invoicing a
     * business contact; `website` is low-cost and commonly expected.
     * `contact_persons.title` already covers job title, so no change there.
     */
    taxId: text("tax_id"),
    website: text("website"),
    /**
     * Optional logo/avatar — a plain nullable FK to `files.id`, following
     * this schema's own `journal_lines.contact_id` precedent for "this
     * table is referenced from elsewhere" rather than a polymorphic
     * association (see files.ts's comment). `onDelete: "set null"` so
     * deleting the underlying file row (not currently exposed via any
     * endpoint, but a safe default) never blocks or cascades onto the
     * contact itself.
     */
    logoFileId: uuid("logo_file_id").references(() => files.id, { onDelete: "set null" }),
    /**
     * Marks a row created by the onboarding "load demo data" seeder (see
     * apps/api/src/modules/demo-data) rather than by a real user action.
     * Lets Settings offer a "delete all demo data" action that only ever
     * touches these rows, never real customer/vendor data. Not surfaced in
     * any list UI — it's purely a filter key for that one bulk-delete op.
     */
    isDemo: boolean("is_demo").notNull().default(false),
    /**
     * PRD §2.1/§9 S-01.15 — the "own vs others" capability split
     * (`contacts.edit_own`/`edit_others`/`delete_own`/`delete_others`) needs
     * to know who created a contact. Nullable: rows written before this
     * column existed have no known creator and are treated as unowned by
     * anyone (only the `_others` capability can touch them, never `_own` —
     * see ContactsService/CatalogService's ownership-check call sites).
     * `onDelete: "set null"` rather than `restrict`/`cascade` — deleting the
     * creating user (e.g. a deactivated staff account removed later) must
     * never block or cascade-delete a contact that still has real business
     * value; the contact simply reverts to unowned.
     */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contacts_org_idx").on(table.orgId),
    index("contacts_org_type_idx").on(table.orgId, table.type),
    index("contacts_org_email_idx").on(table.orgId, table.email),
    index("contacts_org_phone_idx").on(table.orgId, table.phone),
    index("contacts_org_demo_idx").on(table.orgId, table.isDemo),
    index("contacts_created_by_idx").on(table.createdByUserId),
  ],
);

/**
 * A named person at a company contact (or an additional contact for an
 * individual) — PRD F1 "hold multiple contact persons". Belongs to exactly
 * one contact; deleted along with it (a person has no independent meaning
 * once its contact is gone — unlike the contact itself, there's no
 * ledger/document reference directly to a contact_person, so cascade is
 * safe here even though it isn't on `contacts`).
 */
export const contactPersons = pgTable(
  "contact_persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    /**
     * Optional photo — same nullable-FK-to-`files.id` pattern as
     * `contacts.logoFileId` above (`onDelete: "set null"` for the same
     * reason: deleting the underlying file row should never block or
     * cascade onto the person).
     */
    logoFileId: uuid("logo_file_id").references(() => files.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contact_persons_contact_idx").on(table.contactId)],
);

export const addressTypeEnum = pgEnum("address_type", ["billing", "shipping", "site", "other"]);

/** PRD F1 "multiple addresses" — belongs to a contact, cascades with it. */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: addressTypeEnum("type").notNull().default("billing"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("addresses_contact_idx").on(table.contactId)],
);

/**
 * Fixed pipeline stages for v1. PRD F1 says "configurable stages" but true
 * per-org configurable stages (add/rename/reorder) is a materially bigger
 * feature (a stages table, referential integrity when a stage is deleted
 * out from under existing leads, a reorder UI) — deferred per the task
 * brief. This enum is deliberately the seam: swapping it for a
 * `lead_stages` table later only touches this file and the pipeline
 * board/list UI, not the rest of the leads model.
 */
export const leadStageEnum = pgEnum("lead_stage", ["new", "qualified", "proposal", "won", "lost"]);

/**
 * PRD F1 "MUST track leads through configurable stages with an estimated
 * value." Always belongs to a contact (a lead is an opportunity with an
 * existing or prospective contact — this pass requires the contact to
 * already exist rather than supporting a bare "unqualified lead with no
 * contact yet," since PRD doesn't call out lead-without-contact and
 * requiring a contact first keeps the model simple).
 *
 * `valueAmount`/`valueCurrency` follow the Money shape from
 * packages/shared/src/money (bigint minor units + ISO code) per CLAUDE.md's
 * non-negotiable money rule — stored as two plain columns rather than a
 * composite type since Drizzle/pg have no first-class Money type, matching
 * how `journal_lines.debit`/`credit` are plain bigint columns elsewhere.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    stage: leadStageEnum("stage").notNull().default("new"),
    valueAmount: bigint("value_amount", { mode: "bigint" }).notNull().default(sql`0`),
    valueCurrency: text("value_currency").notNull(),
    source: text("source"),
    /** Assigned pipeline owner (the rep working this lead) — distinct from `createdByUserId` below, and reassignable; never used as the "own vs others" ownership signal, only `createdByUserId` is (see that column's comment). */
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    /**
     * PRD §2.1/§9 S-01.16 — the "own vs others" capability split
     * (`leads.edit_own`/`edit_others`/`delete_own`/`delete_others`), same
     * pattern as `contacts.createdByUserId` above: nullable (pre-migration
     * rows have no known creator and are treated as unowned by anyone, only
     * touchable via the `_others` capability), set once at creation, never
     * reassigned, `onDelete: "set null"` so deleting the creating user never
     * blocks or cascades onto a lead that still has real business value.
     * Deliberately NOT `ownerUserId` above — that field is a reassignable
     * pipeline-rep assignment, not a fixed "who created this" fact, so it's
     * the wrong signal for a permission check that must stay stable even
     * after a lead changes hands.
     */
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_org_idx").on(table.orgId),
    index("leads_org_stage_idx").on(table.orgId, table.stage),
    index("leads_contact_idx").on(table.contactId),
    index("leads_owner_idx").on(table.ownerUserId),
    index("leads_created_by_idx").on(table.createdByUserId),
  ],
);

export const activityTypeEnum = pgEnum("activity_type", ["call", "meeting", "note", "task"]);

/**
 * PRD F1 "MUST log activities against a contact or lead" + S-01.6/S-01.7
 * (follow-up date, overdue-follow-ups list). Linked to a contact and/or a
 * lead — at least one should be set (enforced at the service layer, not a
 * DB CHECK, to keep this consistent with how the rest of this schema
 * validates: e.g. `journal_lines`' one-sided check is a rare exception for
 * a financial-integrity invariant, not the norm for business tables).
 * `dueAt`/`doneAt` together drive "overdue" (`dueAt < now() AND doneAt IS
 * NULL`) without a separate status enum.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    assignedToUserId: text("assigned_to_user_id").references(() => user.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activities_org_idx").on(table.orgId),
    index("activities_contact_idx").on(table.contactId),
    index("activities_lead_idx").on(table.leadId),
    index("activities_org_due_idx").on(table.orgId, table.dueAt),
    index("activities_assigned_idx").on(table.assignedToUserId),
  ],
);
