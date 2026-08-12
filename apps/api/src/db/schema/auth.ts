import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  /**
   * S-10.17 — personal preference, app-owned column on Better Auth's `user`
   * table (same pattern as `member.isActive`/`deactivatedAt` below: Better
   * Auth has no concept of this, so it's a minimal addition rather than a
   * separate one-row-per-user table). "system"/"light"/"dark", not enforced
   * by a DB check — validated at the app/Zod layer, matching this schema's
   * general preference for keeping small enum-ish fields as plain text.
   */
  themePreference: text("theme_preference").default("system").notNull(),
  /**
   * S-09.13 (dashboard v2) — per-user dashboard widget order/visibility,
   * the first dashboard-LAYOUT preference in the app (distinct from
   * `themePreference` above, which is a single flat value, not a list).
   * Nullable — absent means "every widget the viewer's role/capabilities
   * make visible, in DASHBOARD_WIDGETS' registry order, none hidden."
   * Shape: Array<{ widgetKey: string; position: number; hidden: boolean }>
   * (`packages/shared/src/schemas/dashboard-widgets.ts` is the source of
   * truth for valid widgetKey values). A saved widgetKey not present in
   * that registry (a removed/renamed widget) is skipped at read/merge
   * time in `DashboardShell`, never rejected at write time — a stale key
   * must stay storable so a user is never blocked from saving a layout
   * change just because a widget was removed from the registry since they
   * last saved. One JSON column rather than a dedicated table — the whole
   * layout is always read/written as one atomic unit (never "just this
   * user's position for widget X" as an isolated query), the same
   * flexible-shape role `settings.value` already plays for org-level
   * preferences one table over.
   */
  dashboardLayout: jsonb("dashboard_layout"),
  /**
   * PRD S-10.22 — per-user override of the org's default meeting-reminder
   * lead time (minutes before a meeting starts to send the S-10.21
   * "starting soon" notification). Nullable, same "absent = fall back"
   * convention as `dashboardLayout`: null means "use the org default"
   * (`settings` key `meeting_reminder_lead_minutes`), which itself falls
   * back to a hardcoded default if the org has never set one — see
   * MeetingReminderWorker for the full three-tier resolution order.
   */
  meetingReminderLeadMinutes: integer("meeting_reminder_lead_minutes"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
    /**
     * S-10.3 — "deactivate a user without deleting their history". This is
     * deliberately an app-owned column on Better Auth's `member` table, not
     * Better Auth's own admin-plugin `user.banned` field: that field is
     * global/instance-wide (bans the person everywhere), whereas
     * deactivation here must be per-organisation membership — it only
     * revokes this org's access and must never touch journal lines, audit
     * entries, or anything else keyed by `user_id`. Better Auth has no
     * built-in per-membership disable, so this is the minimal addition.
     * A deactivated member's session is rejected by an org-role check
     * (deactivated members carry no usable role), not by deleting the row.
     */
    isActive: boolean("is_active").default(true).notNull(),
    deactivatedAt: timestamp("deactivated_at"),
    /**
     * PRD §2.1/§7 — the instance's super-admin. Exactly one member row per
     * organisation may have this set; enforced below by a partial unique
     * index rather than relying on application logic alone. Set once, on
     * the very first signup (see auth.ts's user.create.after hook), and
     * moved only via an explicit transfer action — never a side effect of
     * promote/demote or deactivation.
     */
    isPrimaryOwner: boolean("is_primary_owner").default(false).notNull(),
    /**
     * Demo-data marker, same convention as contacts.isDemo/quotes.isDemo —
     * but deliberately scoped to the MEMBERSHIP row, not the underlying
     * `user`/`account` login row. `DemoDataService.deleteAll` removes a
     * demo member's org access (this row) on cleanup, never the person's
     * actual account/session/credential history — deleting a login account
     * is a materially bigger, harder-to-reverse action than removing a
     * business record, and Primary-Owner-only orgs must never accidentally
     * lose their only Owner if a demo membership happened to be marked
     * incorrectly (see the primary-owner uniqueness index above — demo
     * members are never seeded as Primary Owner, only staff/field).
     */
    isDemo: boolean("is_demo").default(false).notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    // At most one primary owner per org. "At least one exists" is an
    // application invariant (signup hook + promote/demote/transfer
    // endpoints never allow the last one to be removed), not something a
    // DB constraint alone can express.
    uniqueIndex("member_org_primary_owner_uidx")
      .on(table.organizationId)
      .where(sql`${table.isPrimaryOwner} = true`),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at"),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));
