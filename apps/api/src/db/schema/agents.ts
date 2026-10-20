import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { oauthClient, organization, user } from "./auth";

export const agentConnectionEndEnum = pgEnum("agent_connection_end", ["disconnected", "owner", "deactivated", "removed", "password_reset", "idle"]);

/**
 * US-MCP-03, US-MCP-04 (D-258) — one person's connection to one agent: made
 * when they press Allow on the consent page, alongside Better Auth's
 * `oauth_consent`. `/mcp` refuses a token unless its connection is live here,
 * so ending one (disconnect, an Owner, deactivation, a reset, 30 days idle)
 * stops the agent at once even though its JWT can't be revoked. Ended rows
 * stay for the record.
 */
export const agentConnections = pgTable(
  "agent_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    oauthClientId: text("oauth_client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientHost: text("client_host").notNull(),
    /** True for a CIMD agent (its address is its identity); false for one that registered itself. */
    verified: boolean("verified").notNull(),
    scopes: text("scopes").array().notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: agentConnectionEndEnum("ended_reason"),
  },
  (t) => [
    uniqueIndex("agent_connections_live_uidx").on(t.userId, t.oauthClientId).where(sql`${t.endedAt} is null`),
    index("agent_connections_org_idx").on(t.orgId),
  ],
);
