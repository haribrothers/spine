import { relations } from "drizzle-orm";
import { pgTable, uuid, text, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";
import { organization, member } from "./auth";

/**
 * PRD §2.1/§7 — Teams subdivide the Staff tier with a configurable
 * privilege matrix (team_privileges). Owner and Field stay fixed,
 * non-configurable roles on `member.role` and never touch these tables.
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Marks the auto-seeded "General Staff" team. Informational + used to
    // block deletion of the seeded default and to identify the fallback
    // team new Staff invites land in.
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("teams_org_id_idx").on(table.orgId),
    unique("teams_org_name_unique").on(table.orgId, table.name),
  ],
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // References member.id (the org-membership row), not user.id directly —
    // a team assignment is inherently org-scoped, member.id already encodes
    // (org, user), and deactivating a member cascades team memberships for
    // free.
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("team_memberships_team_id_idx").on(table.teamId),
    index("team_memberships_member_id_idx").on(table.memberId),
    unique("team_memberships_team_member_unique").on(table.teamId, table.memberId),
  ],
);

export const teamPrivileges = pgTable(
  "team_privileges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // Validated against CAPABILITIES (@spine/shared) at the app/Zod layer,
    // not a Postgres enum — keeps adding a capability a pure code change,
    // no migration required. Mirrors the settings table's jsonb-value
    // precedent for extensibility.
    capability: text("capability").notNull(),
    granted: boolean("granted").notNull().default(false),
  },
  (table) => [
    index("team_privileges_team_id_idx").on(table.teamId),
    unique("team_privileges_team_capability_unique").on(table.teamId, table.capability),
  ],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(teamMemberships),
  privileges: many(teamPrivileges),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
  member: one(member, { fields: [teamMemberships.memberId], references: [member.id] }),
}));

export const teamPrivilegesRelations = relations(teamPrivileges, ({ one }) => ({
  team: one(teams, { fields: [teamPrivileges.teamId], references: [teams.id] }),
}));
