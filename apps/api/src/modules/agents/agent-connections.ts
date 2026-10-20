import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { AGENT_IDLE_DAYS, type AgentConnectionEnd } from "@spine/shared";
import type { Database, Transaction } from "../../db/client";
import { agentConnections, oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

type Db = Database | Transaction;
type ClientRow = typeof oauthClient.$inferSelect;

const hostOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
};

/**
 * Who the agent is, as the consent page and the connection lists show it.
 * A CIMD agent's `client_id` is its https address, so its host is checked
 * and its name trusted; one that registered itself (DCR) only claims a name,
 * so it's marked unverified and shown by the host it returns to (D-258).
 */
export function agentIdentity(client: Pick<ClientRow, "clientId" | "name" | "redirectUris" | "clientDiscoveryId">): { name: string; host: string; verified: boolean } {
  const verified = /^https:\/\//i.test(client.clientId) || client.clientDiscoveryId === "cimd";
  const host = (verified ? hostOf(client.clientId) : null) ?? hostOf(client.redirectUris?.[0]) ?? "unknown";
  return { name: client.name?.trim() || host, host, verified };
}

export async function loadAgentClient(db: Db, clientId: string): Promise<ClientRow | null> {
  return (await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId)).limit(1))[0] ?? null;
}

/** The live connection between a person and an agent, if any. */
export async function liveAgentConnection(db: Db, userId: string, clientId: string) {
  return (
    (
      await db
        .select()
        .from(agentConnections)
        .where(and(eq(agentConnections.userId, userId), eq(agentConnections.oauthClientId, clientId), isNull(agentConnections.endedAt)))
        .limit(1)
    )[0] ?? null
  );
}

/**
 * US-MCP-03 — after the person presses Allow: their connection to the agent,
 * with the scopes they granted (from Better Auth's consent), and "Connected
 * <Agent>" in the audit log. Allowing again updates what it may do.
 */
export async function recordAgentConnection(db: Database, input: { userId: string; orgId: string; clientId: string }): Promise<void> {
  const client = await loadAgentClient(db, input.clientId);
  if (!client) return;
  const [consent] = await db
    .select({ scopes: oauthConsent.scopes })
    .from(oauthConsent)
    .where(and(eq(oauthConsent.userId, input.userId), eq(oauthConsent.clientId, input.clientId)))
    .orderBy(desc(oauthConsent.updatedAt))
    .limit(1);
  if (!consent) return;
  const agent = agentIdentity(client);
  await db.transaction(async (tx) => {
    const live = await liveAgentConnection(tx, input.userId, input.clientId);
    if (live) {
      await tx.update(agentConnections).set({ scopes: consent.scopes, clientName: agent.name, clientHost: agent.host, verified: agent.verified }).where(eq(agentConnections.id, live.id));
      return;
    }
    const [row] = await tx
      .insert(agentConnections)
      .values({ orgId: input.orgId, userId: input.userId, oauthClientId: input.clientId, clientName: agent.name, clientHost: agent.host, verified: agent.verified, scopes: consent.scopes })
      .returning({ id: agentConnections.id });
    await new AuditLogService(db).record(tx, {
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "connected",
      entityType: "agent_connection",
      entityId: row!.id,
      contactId: null,
      changes: { agent: agent.name, host: agent.host, verified: agent.verified, scopes: consent.scopes },
    });
  });
}

/**
 * Ends a person's live connections — one agent's, or all of them — and with
 * them Better Auth's consents and tokens, so the agent has to connect again.
 * `/mcp` checks the connection on every call, so it stops at once.
 */
export async function endAgentConnections(db: Database, input: { userId: string; clientId?: string; reason: AgentConnectionEnd; actorUserId: string | null }): Promise<number> {
  return db.transaction(async (tx) => {
    const where = and(eq(agentConnections.userId, input.userId), isNull(agentConnections.endedAt), input.clientId ? eq(agentConnections.oauthClientId, input.clientId) : undefined);
    const ended = await tx.update(agentConnections).set({ endedAt: new Date(), endedReason: input.reason }).where(where).returning();
    const client = (column: AnyPgColumn) => (input.clientId ? eq(column, input.clientId) : undefined);
    await tx.delete(oauthConsent).where(and(eq(oauthConsent.userId, input.userId), client(oauthConsent.clientId)));
    await tx.delete(oauthAccessToken).where(and(eq(oauthAccessToken.userId, input.userId), client(oauthAccessToken.clientId)));
    await tx.delete(oauthRefreshToken).where(and(eq(oauthRefreshToken.userId, input.userId), client(oauthRefreshToken.clientId)));
    for (const row of ended) {
      await new AuditLogService(db).record(tx, {
        orgId: row.orgId,
        actorUserId: input.actorUserId,
        action: "disconnected",
        entityType: "agent_connection",
        entityId: row.id,
        contactId: null,
        changes: { agent: row.clientName, host: row.clientHost, reason: input.reason },
      });
    }
    return ended.length;
  });
}

/**
 * US-MCP-04 (D-258) — connections unused for 30 days end ("idle"), with
 * their consents and tokens; the agent connects again. Checked whenever a
 * list is read and on every `/mcp` call, so no scheduled job is needed.
 */
export async function endIdleAgentConnections(db: Database, where: { orgId?: string; connectionId?: string }): Promise<number> {
  const cutoff = new Date(Date.now() - AGENT_IDLE_DAYS * 24 * 60 * 60 * 1000);
  const idle = await db
    .select({ userId: agentConnections.userId, clientId: agentConnections.oauthClientId })
    .from(agentConnections)
    .where(
      and(
        isNull(agentConnections.endedAt),
        where.orgId ? eq(agentConnections.orgId, where.orgId) : undefined,
        where.connectionId ? eq(agentConnections.id, where.connectionId) : undefined,
        sql`coalesce(${agentConnections.lastUsedAt}, ${agentConnections.connectedAt}) < ${cutoff.toISOString()}::timestamptz`,
      ),
    );
  let ended = 0;
  for (const row of idle) ended += await endAgentConnections(db, { userId: row.userId, clientId: row.clientId, reason: "idle", actorUserId: null });
  return ended;
}
