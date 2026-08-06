import { pgTable, uuid, text, boolean, bigint, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organization, user } from "./auth";

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
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contacts_org_idx").on(table.orgId),
    index("contacts_org_type_idx").on(table.orgId, table.type),
    index("contacts_org_email_idx").on(table.orgId, table.email),
    index("contacts_org_phone_idx").on(table.orgId, table.phone),
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
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_org_idx").on(table.orgId),
    index("leads_org_stage_idx").on(table.orgId, table.stage),
    index("leads_contact_idx").on(table.contactId),
    index("leads_owner_idx").on(table.ownerUserId),
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
