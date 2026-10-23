import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PORT = vi.hoisted(() => {
  const port = 4820 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { AuditLogEntry, AuditLogPage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { agentConnections, agentRequests, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, connectAgent } from "../../test-utils/agent-client";
import { callLimiter } from "./mcp.service";

type Who = { cookie: string; userId: string };
type Text = { content: { type: string; text: string }[]; isError?: boolean };
const parse = (r: unknown) => JSON.parse((r as Text).content[0]!.text) as Record<string, unknown>;

/** US-MCP-08 (D-258) — every agent request in the audit log: what, as whom, how it ended; never the arguments. Requires local Postgres. */
describe("US-MCP-08 · see every agent request in the audit log (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;
  let customerId: string;
  let agent: TestAgent;
  let client: Client;
  let connectionId: string;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const agentEntries = async () => (await json<AuditLogPage>(await call(owner, "GET", "/org/audit-log?entityType=agent_request"))).entries;
  const entryFor = (entries: AuditLogEntry[], action: string) => entries.find((e) => e.action === action);

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(base, { email: `us-mcp-08-${randomUUID()}@example.com`, password: "testpassword123", name: "Priya Raman" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    customerId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Harbour Road Residences" }))).id;
    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    agent = new TestAgent("Audit Agent");
    client = await connectAgent(base, owner.cookie, agent);
    connectionId = (await db.select().from(agentConnections).where(and(eq(agentConnections.userId, owner.userId), eq(agentConnections.clientName, "Audit Agent"))))[0]!.id;
  }, 180_000);

  afterAll(async () => {
    await client?.close();
    await testApp?.close();
  });

  it("each call is an Agent request entry: who, the agent, what it did, the record it touched (linked) and that it worked", async () => {
    await client.callTool({ name: "search", arguments: { query: "Harbour Road" } });
    const drafted = parse(await client.callTool({ name: "draft_quote", arguments: { contactId: customerId, title: "Secret deck plans", lines: [{ name: "Carpentry labour", quantity: 1, unitPriceAmount: "19000" }] } }));
    const quoteId = (drafted.quote as { id: string }).id;
    await client.callTool({ name: "get_record", arguments: { type: "quote", id: quoteId } });
    await client.callTool({ name: "receivables", arguments: {} });

    const entries = await agentEntries();
    expect(entryFor(entries, "searched")).toMatchObject({ actor: { userId: owner.userId, name: "Priya Raman" }, entityType: "agent_request", changes: { agent: "Audit Agent", tool: "search", outcome: "ok", summary: "Audit Agent · Worked" } });
    for (const action of ["drafted_quote", "read_quote"]) {
      expect(entryFor(entries, action)).toMatchObject({ recordLabel: "Quote · Draft quote", link: `/quotes/${quoteId}`, changes: { outcome: "ok" } });
    }
    expect(entryFor(entries, "read_receivables")).toMatchObject({ changes: { tool: "receivables", outcome: "ok" } });
    const rows = await db.select().from(agentRequests).where(eq(agentRequests.connectionId, connectionId));
    expect(rows.find((r) => r.tool === "draft_quote")).toMatchObject({ orgId, userId: owner.userId, entityType: "quote", entityId: quoteId, outcome: "ok" });
  });

  it("stores only the tool, the record and the outcome — never the arguments' text or the result", async () => {
    const entries = await agentEntries();
    const text = JSON.stringify(entries) + JSON.stringify(await db.select().from(agentRequests).where(eq(agentRequests.connectionId, connectionId)));
    expect(text).not.toContain("Harbour Road");
    expect(text).not.toContain("Secret deck plans");
    expect(text).not.toContain("Carpentry labour");
  });

  it("a refused call is there with Spine's reason", async () => {
    const missing = (await client.callTool({ name: "get_record", arguments: { type: "quote", number: "Q-9999" } })) as Text;
    expect(missing.isError).toBe(true);
    const refused = (await agentEntries()).find((e) => e.action === "read_quote" && (e.changes as { outcome: string }).outcome === "refused");
    expect((refused!.changes as { summary: string }).summary).toBe("Audit Agent · Refused — No quote Q-9999 that you can open.");
  });

  it("connecting, disconnecting and switching agents on or off are in the log too", async () => {
    const other = new TestAgent("Brief Agent");
    await connectAgent(base, owner.cookie, other);
    const [conn] = await db.select().from(agentConnections).where(and(eq(agentConnections.userId, owner.userId), eq(agentConnections.clientName, "Brief Agent")));
    expect((await call(owner, "DELETE", `/agents/connections/${conn!.id}`)).status).toBe(204);
    const connections = (await json<AuditLogPage>(await call(owner, "GET", `/org/audit-log?entityType=agent_connection&entityId=${conn!.id}`))).entries;
    expect(connections.map((e) => e.action).sort()).toEqual(["connected", "disconnected"]);
    const settings = (await json<AuditLogPage>(await call(owner, "GET", "/org/audit-log?entityType=agents_settings"))).entries;
    expect(settings.length).toBeGreaterThanOrEqual(1);
    expect(settings[0]!.changes).toEqual([{ field: "Connected agents", from: "Off", to: "On" }]);
  });

  it("past 120 calls a minute from one connection, it's told to slow down (429 with Retry-After), and that's logged", async () => {
    for (let i = 0; i < 130; i++) callLimiter.hit(connectionId);
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${agent.tokens()!.access_token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "list_records", arguments: { type: "invoice" } } }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe("Too many requests from this agent. Wait a minute and try again.");
    expect(entryFor(await agentEntries(), "listed_invoices")).toMatchObject({ changes: { outcome: "rate_limited", tool: "list_records" } });
  });
});
