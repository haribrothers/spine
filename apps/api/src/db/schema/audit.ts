import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { contacts } from "./contacts";

/**
 * One entry per create/update/issue/void/delete on any financial document,
 * per §10.4/S-10.6. Written alongside the mutation, never edited afterward.
 *
 * First real write instrumentation lands scoped to Contacts (see
 * apps/api/src/modules/audit/audit-log.service.ts) — `entityType` is one of
 * "contact"/"contact_person"/"address"/"lead"/"activity" for that scope.
 * `contactId` is a nullable denormalized FK, populated for all five of
 * those entity types (equal to `entityId` when `entityType === "contact"`,
 * else the sub-entity's owning contact) so `GET /contacts/:id/history` can
 * query with one indexed WHERE instead of joining across four different
 * sub-entity tables to find "which contact does this audit row belong to."
 * `onDelete: "cascade"` matches `journal_lines.contact_id`'s sibling
 * behavior for rows that only make sense in the context of a contact that
 * still exists — audit history for a hard-deleted contact has no page left
 * to render it on.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    changes: jsonb("changes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_org_idx").on(table.orgId),
    index("audit_log_contact_idx").on(table.contactId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
  ],
);
