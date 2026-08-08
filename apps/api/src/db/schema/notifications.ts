import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * PRD S-10.11 (added 2026-08-08 at the user's explicit request — see
 * CHANGELOG for the scope discussion) — the persisted, in-app-visible half
 * of a notification. `NotificationsService.notify()` (built in Quotes
 * Stage 3, S-03.7) already queues an email per recipient; this table is the
 * second, additive delivery channel for the same trigger points, not a
 * replacement.
 *
 * One row per (event, recipient) pair — fan-out on write, mirroring
 * `notify()`'s own existing per-owner email fan-out (`owners.map(...)`).
 * Read/unread state is inherently per-user, so this is simpler and more
 * directly queryable than one shared event row plus a separate read-tracking
 * join table would be, at the cost of duplicating `message`/`link` across
 * recipients of the same event — an acceptable tradeoff given notification
 * volume is low (one row per quote view/accept/reject per org member with
 * access, not a high-frequency stream).
 *
 * `message` is pre-rendered plain text (not a template + params) — mirrors
 * `NotifyEmailJobData`'s own `subject`/`text` fields, which are already
 * fully composed by the caller before reaching `NotificationsService`. No
 * client-side templating layer exists or is needed for this.
 *
 * `readAt` is a nullable timestamp, not a boolean — matches `audit_log`'s
 * own "timestamp records both the fact and the moment" convention rather
 * than a bare `is_read` flag that would lose *when* it was read.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** e.g. "quote_viewed", "quote_accepted" — a short machine-readable tag, not currently used for anything beyond display/future filtering. */
    type: text("type").notNull(),
    message: text("message").notNull(),
    /** Nullable — a relative in-app path (e.g. "/quotes/:id") the notification's row links to when clicked. Not every notification needs one. */
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_org_recipient_idx").on(table.orgId, table.recipientUserId),
    /** Backs the unread-count query (`readAt IS NULL`) and the drawer's own newest-first unread-first listing. */
    index("notifications_recipient_unread_idx").on(table.recipientUserId, table.readAt),
  ],
);
