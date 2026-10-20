import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4740 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { AgentConnection, MyAgentConnections } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { agentConnections, auditLog, member, notifications, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";

type Who = { cookie: string; userId: string };

/** US-MCP-04 (D-258) — see and disconnect connected agents. Requires local Postgres. */
describe("US-MCP-04 · see and disconnect connected agents (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const ping = (agent: TestAgent) =>
    fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${agent.tokens()!.access_token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-04-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("each person sees only their own connections, with what each may do, and the address to add another", async () => {
    await connectAgent(base, owner.cookie, new TestAgent("Owner Agent"));
    await connectAgent(base, staff.cookie, new TestAgent("Staff Agent"), { scope: "spine:read" });
    const mine = await json<MyAgentConnections>(await call(staff, "GET", "/agents/connections"));
    expect(mine.mcpUrl).toBe(`${base}/mcp`);
    expect(mine.connections.map((c) => c.clientName)).toEqual(["Staff Agent"]);
    expect(mine.connections[0]).toMatchObject({ verified: false, clientHost: "localhost:47999", scopes: ["spine:read"] });
    // Connecting is its first use (the agent's initialize call).
    expect(mine.connections[0]!.lastUsedAt).not.toBeNull();
    expect(mine.connections[0]).not.toHaveProperty("user");
  });

  it("disconnecting your own stops it at once, records why, and can't be done twice or to someone else's", async () => {
    const agent = new TestAgent("Short-lived Agent");
    await connectAgent(base, staff.cookie, agent);
    expect((await ping(agent)).status).toBe(200);
    const { connections } = await json<MyAgentConnections>(await call(staff, "GET", "/agents/connections"));
    const target = connections.find((c) => c.clientName === "Short-lived Agent")!;
    expect(target.lastUsedAt).not.toBeNull();

    const ownersAgent = (await json<MyAgentConnections>(await call(owner, "GET", "/agents/connections"))).connections[0]!;
    expect((await call(staff, "DELETE", `/agents/connections/${ownersAgent.id}`)).status).toBe(404);

    expect((await call(staff, "DELETE", `/agents/connections/${target.id}`)).status).toBe(204);
    expect((await ping(agent)).status).toBe(401);
    expect((await call(staff, "DELETE", `/agents/connections/${target.id}`)).status).toBe(404);
    const [row] = await db.select().from(agentConnections).where(eq(agentConnections.id, target.id));
    expect(row).toMatchObject({ endedReason: "disconnected" });
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, target.id), eq(auditLog.action, "disconnected")));
    expect(entry).toMatchObject({ actorUserId: staff.userId });
  });

  it("an Owner sees everyone's, with whose and their role, and can end anyone's — the person is told", async () => {
    const agent = new TestAgent("Kavya's ChatGPT");
    await connectAgent(base, staff.cookie, agent);
    const all = await json<AgentConnection[]>(await call(owner, "GET", "/org/agents/connections"));
    const theirs = all.find((c) => c.clientName === "Kavya's ChatGPT")!;
    expect(theirs.user).toMatchObject({ id: staff.userId, name: "Kavya Iyer", role: "staff" });
    expect(all.some((c) => c.user?.id === owner.userId)).toBe(true);

    expect((await call(staff, "GET", "/org/agents/connections")).status).toBe(403);
    expect((await call(staff, "DELETE", `/org/agents/connections/${theirs.id}`)).status).toBe(403);

    expect((await call(owner, "DELETE", `/org/agents/connections/${theirs.id}`)).status).toBe(204);
    expect((await ping(agent)).status).toBe(401);
    expect((await db.select().from(agentConnections).where(eq(agentConnections.id, theirs.id)))[0]).toMatchObject({ endedReason: "owner" });
    await vi.waitFor(async () => {
      const [note] = await db.select().from(notifications).where(and(eq(notifications.recipientUserId, staff.userId), eq(notifications.type, "agent_disconnected")));
      expect(note?.message).toBe("Priya Raman disconnected Kavya's ChatGPT from your account.");
    });
  });

  it("a connection unused for 30 days has ended: it leaves the lists and its agent is refused", async () => {
    const agent = new TestAgent("Forgotten Agent");
    await connectAgent(base, owner.cookie, agent);
    const [row] = await db.select().from(agentConnections).where(eq(agentConnections.clientName, "Forgotten Agent"));
    await db.update(agentConnections).set({ connectedAt: new Date(Date.now() - 31 * 86_400_000), lastUsedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(agentConnections.id, row!.id));
    expect((await ping(agent)).status).toBe(401);
    expect((await db.select().from(agentConnections).where(eq(agentConnections.id, row!.id)))[0]).toMatchObject({ endedReason: "idle" });
    expect((await json<MyAgentConnections>(await call(owner, "GET", "/agents/connections"))).connections.map((c) => c.clientName)).not.toContain("Forgotten Agent");
  });

  it("while Connected agents is off, the person's list is refused like every other agents route", async () => {
    expect((await call(owner, "PUT", "/org/agents", { enabled: false })).status).toBe(200);
    const res = await call(staff, "GET", "/agents/connections");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("MODULE_OFF");
    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
  });
});
