import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * PRD S-10.12 (added 2026-08-08) — one row per browser/device push
 * subscription, the Web Push API's `PushSubscription.toJSON()` shape
 * (`endpoint` + a `keys.p256dh`/`keys.auth` pair) persisted so
 * `NotificationsService.notify()` can call `web-push`'s `sendNotification`
 * for every subscription belonging to a matched recipient. A user can have
 * several rows (one per browser/device) — each is independent, so revoking
 * one never touches another, matching S-10.12's acceptance highlight.
 *
 * `endpoint` is unique on its own (not per-user) — the push service URL
 * itself already uniquely identifies a subscription; re-subscribing the
 * same browser (e.g. after clearing the permission and re-granting it)
 * naturally produces a new endpoint, and an upsert on `endpoint` handles
 * the case where the same browser subscribes again before its old row was
 * explicitly revoked.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("push_subscriptions_user_idx").on(table.orgId, table.userId),
    unique("push_subscriptions_endpoint_key").on(table.endpoint),
  ],
);
