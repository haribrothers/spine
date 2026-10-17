import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const aiFeatureEnum = pgEnum("ai_feature", ["read_document", "draft_email", "draft_quote_lines", "bank_suggestions"]);
export const aiOutcomeEnum = pgEnum("ai_outcome", ["ok", "error", "timeout", "budget", "rate_limited"]);

/**
 * US-AI-04, US-AI-06 (D-168, D-169) — one row per AI request: who, which
 * feature, the record it was for, the provider and model, tokens in and out,
 * how long it took and how it ended. Never the prompt or the reply. Usage
 * and the monthly budget are summed from here; the audit log lists it.
 */
export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    feature: aiFeatureEnum("feature").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    outcome: aiOutcomeEnum("outcome").notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_requests_org_created_idx").on(table.orgId, table.createdAt), index("ai_requests_user_created_idx").on(table.userId, table.createdAt)],
);
