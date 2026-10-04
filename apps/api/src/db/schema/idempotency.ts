import { pgTable, uuid, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Backs the `Idempotency-Key` header required on mutating endpoints per
 * CLAUDE.md/§10.4/§6.6 (critical for the mobile offline outbox, but applied
 * here to the onboarding wizard's write endpoints too, as the first module
 * with real mutating routes). This is the first place in the codebase this
 * pattern is established — nothing to follow, nothing existing to diverge
 * from. Keyed on (orgId, userId, endpoint, key) — per user, and per actual
 * path rather than route pattern — so the same key value can't collide
 * across people, devices or records (US-OPS-08).
 *
 * A replayed request with a key already present in this table short-circuits
 * to the stored response instead of re-running the mutation. Rows are cheap
 * and small; a periodic cleanup job (not built here) could prune rows older
 * than a day or two — not required for correctness, only for table growth.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Who sent the request: keys are scoped per user, so two people or devices can't collide (US-OPS-08). Null only on rows from before US-OPS-08. */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    /** Method and the actual path (`POST /invoices/<id>/issue`), so a key reused on another record never replays the wrong response. */
    endpoint: text("endpoint").notNull(),
    key: text("key").notNull(),
    /** The response body returned the first time, replayed verbatim on retry. */
    responseBody: jsonb("response_body"),
    responseStatus: text("response_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("idempotency_keys_org_user_endpoint_key_unique").on(table.orgId, table.userId, table.endpoint, table.key)],
);
