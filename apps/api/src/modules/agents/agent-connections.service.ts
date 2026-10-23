import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { agentDisconnectedByOwner, type AgentConnection, type MyAgentConnections } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { agentConnections, member, user } from "../../db/schema";
import { NotificationsService } from "../notifications/notifications.service";
import { endAgentConnections, endIdleAgentConnections } from "./agent-connections";
import { mcpUrl } from "./mcp-url";

type Row = typeof agentConnections.$inferSelect;

const present = (r: Row, who?: { id: string; name: string; role: string }): AgentConnection => ({
  id: r.id,
  clientName: r.clientName,
  clientHost: r.clientHost,
  verified: r.verified,
  scopes: r.scopes,
  connectedAt: r.connectedAt.toISOString(),
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  ...(who ? { user: { id: who.id, name: who.name, role: who.role as NonNullable<AgentConnection["user"]>["role"] } } : {}),
});

/**
 * US-MCP-04 (D-258) — each person's live connections, every connection for
 * an Owner, and disconnecting: the person's own (`disconnected`), or anyone's
 * by an Owner (`owner`, and the person is told). Ending one deletes its
 * consent and tokens, so the agent stops at once and has to connect again.
 */
@Injectable()
export class AgentConnectionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async mine(orgId: string, userId: string): Promise<MyAgentConnections> {
    await endIdleAgentConnections(this.db, { orgId });
    const rows = await this.db
      .select()
      .from(agentConnections)
      .where(and(eq(agentConnections.orgId, orgId), eq(agentConnections.userId, userId), isNull(agentConnections.endedAt)))
      .orderBy(desc(agentConnections.connectedAt));
    return { mcpUrl: mcpUrl(), connections: rows.map((r) => present(r)) };
  }

  async all(orgId: string): Promise<AgentConnection[]> {
    await endIdleAgentConnections(this.db, { orgId });
    const rows = await this.db
      .select({ c: agentConnections, name: user.name, role: member.role })
      .from(agentConnections)
      .innerJoin(user, eq(user.id, agentConnections.userId))
      .leftJoin(member, and(eq(member.userId, agentConnections.userId), eq(member.organizationId, agentConnections.orgId)))
      .where(and(eq(agentConnections.orgId, orgId), isNull(agentConnections.endedAt)))
      .orderBy(desc(agentConnections.connectedAt));
    return rows.map((r) => present(r.c, { id: r.c.userId, name: r.name, role: r.role ?? "staff" }));
  }

  async disconnectMine(orgId: string, userId: string, id: string): Promise<void> {
    const row = await this.live(orgId, id);
    if (!row || row.userId !== userId) throw new NotFoundException("No connected agent like that. It may already be disconnected.");
    await endAgentConnections(this.db, { userId, clientId: row.oauthClientId, reason: "disconnected", actorUserId: userId });
  }

  async disconnectAny(orgId: string, ownerId: string, id: string): Promise<void> {
    const row = await this.live(orgId, id);
    if (!row) throw new NotFoundException("No connected agent like that. It may already be disconnected.");
    const own = row.userId === ownerId;
    await endAgentConnections(this.db, { userId: row.userId, clientId: row.oauthClientId, reason: own ? "disconnected" : "owner", actorUserId: ownerId });
    if (own) return;
    const [owner] = await this.db.select({ name: user.name }).from(user).where(eq(user.id, ownerId));
    const message = agentDisconnectedByOwner(owner?.name ?? "An Owner", row.clientName);
    void this.notifications.notify(orgId, {
      subject: message,
      text: `${message} It can't use Spine as you until you connect it again.`,
      recipientUserIds: [row.userId],
      inApp: { type: "agent_disconnected", message, link: "/dashboard?settings=my-connected-agents" },
    });
  }

  private async live(orgId: string, id: string): Promise<Row | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return (await this.db.select().from(agentConnections).where(and(eq(agentConnections.id, id), eq(agentConnections.orgId, orgId), isNull(agentConnections.endedAt))))[0] ?? null;
  }
}
