import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const emailKindEnum = pgEnum("email_kind", [
  "quote",
  "invoice",
  "invoice_reminder",
  "credit_note",
  "receipt",
  "refund",
  "statement",
  "remittance",
  "notification",
  "digest",
  "invitation",
  "password_reset",
  "verification",
  "data_export",
  "test",
]);

export const emailLogStatusEnum = pgEnum("email_log_status", ["queued", "retrying", "sending", "sent", "failed", "cancelled"]);

/**
 * US-SET-27/28 (D-220) — one row per email Spine sends or is about to send,
 * written by `EmailService` (sent straight away) or `EmailLogService.enqueue`
 * (queued; the worker moves it through `sending` to `sent`, `retrying` or
 * `failed`). No message bodies: the record holds the document. A queued
 * email keeps its queue and job payload so an Owner can retry it. Rows older
 * than 180 days are deleted by the daily `email-log-cleanup` job.
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null for an email sent before an organisation exists; such rows are never listed. */
    orgId: text("org_id").references(() => organization.id, { onDelete: "cascade" }),
    kind: emailKindEnum("kind").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    status: emailLogStatusEnum("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    lastError: text("last_error"),
    queue: text("queue"),
    jobId: text("job_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    cancelledByUserId: text("cancelled_by_user_id").references(() => user.id, { onDelete: "set null" }),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_log_org_queued_idx").on(table.orgId, table.queuedAt.desc()), index("email_log_org_status_idx").on(table.orgId, table.status)],
);
