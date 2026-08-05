import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * One entry per create/update/issue/void/delete on any financial document,
 * per §10.4/S-10.6. Written alongside the mutation, never edited afterward.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
