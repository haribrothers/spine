import { pgTable, uuid, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { organization } from "./auth";

/**
 * Identity/org/session/membership tables (organization, user, session,
 * member, invitation) are owned by Better Auth — see src/auth/auth.ts and
 * the generated schema in ./auth.ts. This file holds the org-scoped app
 * settings that Better Auth has no opinion about.
 */
export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("settings_org_key_unique").on(table.orgId, table.key)],
);
