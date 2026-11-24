import { randomUUID } from "node:crypto";
import { and, eq, isNull, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The OAuth issuer and the MCP resource are this server's own address, so it listens where API_URL says.
const PORT = vi.hoisted(() => {
  const port = 4720 + Number(process.env.VITEST_POOL_ID ?? 0);
  process.env.API_URL = `http://localhost:${port}`;
  return port;
});

import { createDb, type Database } from "../../db/client";
import { agentConnections, auditLog, member, oauthClient, session as sessionTable, verification } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TestAgent, answerConsent, connectAgent, mcpClient, openAuthorize } from "../../test-utils/agent-client";
import { useClientMetadataFetchForTests } from "./client-metadata-fetch";

type Who = { cookie: string; userId: string };

/** US-MCP-03 (D-257, D-258) — connect an AI agent to Spine: discovery, CIMD and registration, consent, and what ends a connection. Requires local Postgres. */
describe("US-MCP-03 · connect an AI agent to Spine (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const base = `http://localhost:${PORT}`;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const rpc = (token: string | null, body: unknown) =>
    fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  // Tools arrive from US-MCP-05; a ping is enough to show the connection works.
  const listTools = { jsonrpc: "2.0", id: 1, method: "ping", params: {} };

  beforeAll(async () => {
    testApp = await createTestApp({ port: PORT });
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"]] as const) {
      Object.assign(who, await signUp(base, { email: `us-mcp-03-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    useClientMetadataFetchForTests(null);
    await testApp?.close();
  });

  it("an agent with no token is told where to sign in (RFC 9728), and Spine's metadata says how (PKCE S256, CIMD)", async () => {
    const res = await rpc(null, listTools);
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate")!;
    expect(challenge).toContain(`resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`);

    const prm = (await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json()) as { resource: string; authorization_servers: string[]; scopes_supported: string[] };
    expect(prm.resource).toBe(`${base}/mcp`);
    expect(prm.scopes_supported).toEqual(expect.arrayContaining(["spine:read", "spine:draft"]));

    const issuer = prm.authorization_servers[0]!;
    const asPath = new URL(issuer).pathname;
    const as = (await (await fetch(`${base}/.well-known/oauth-authorization-server${asPath}`)).json()) as Record<string, unknown>;
    expect(as.issuer).toBe(issuer);
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.client_id_metadata_document_supported).toBe(true);
    expect(as.registration_endpoint).toBeTruthy();
  });

  it("an agent that registers itself connects after the person allows it; the connection is recorded unverified and audited", async () => {
    const agent = new TestAgent("Claude Code");
    const client = await connectAgent(base, owner.cookie, agent);
    expect(await client.ping()).toBeDefined();
    const [row] = await db.select().from(agentConnections).where(and(eq(agentConnections.userId, owner.userId), isNull(agentConnections.endedAt), eq(agentConnections.clientName, "Claude Code")));
    expect(row).toMatchObject({ orgId, verified: false, clientHost: "localhost:47999" });
    expect(row!.scopes).toEqual(expect.arrayContaining(["spine:read", "spine:draft"]));
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "agent_connection"), eq(auditLog.entityId, row!.id)));
    expect(entry).toMatchObject({ action: "connected", actorUserId: owner.userId });
    await client.close();
  });

  it("a CIMD agent is identified by its https address and connects as verified", async () => {
    const clientId = "https://agent.spine-test-cimd.com/oauth/client.json";
    useClientMetadataFetchForTests(async (input) => {
      expect(String(input instanceof Request ? input.url : input)).toBe(clientId);
      return new Response(
        JSON.stringify({ client_id: clientId, client_name: "Claude", redirect_uris: ["http://localhost:47999/callback"], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", application_type: "native" }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "max-age=300" } },
      );
    });
    const client = await connectAgent(base, staff.cookie, new TestAgent("Claude", clientId));
    const [row] = await db.select().from(agentConnections).where(and(eq(agentConnections.userId, staff.userId), eq(agentConnections.oauthClientId, clientId)));
    expect(row).toMatchObject({ verified: true, clientHost: "agent.spine-test-cimd.com", clientName: "Claude" });
    expect((await db.select().from(oauthClient).where(eq(oauthClient.clientId, clientId))).length).toBe(1);
    await client.close();
  });

  it("leaving drafts unticked connects with read only", async () => {
    const agent = new TestAgent("Read-only Agent");
    const client = await connectAgent(base, owner.cookie, agent, { scope: "spine:read" });
    const [row] = await db.select().from(agentConnections).where(and(eq(agentConnections.clientName, "Read-only Agent"), isNull(agentConnections.endedAt)));
    expect(row!.scopes).toContain("spine:read");
    expect(row!.scopes).not.toContain("spine:draft");
    await client.close();
  });

  it("refuses a request without PKCE or for another resource, and Cancel connects nothing", async () => {
    const agent = new TestAgent("Careless Agent");
    const { client, transport } = mcpClient(base, agent);
    await client.connect(transport).catch(() => {});
    const noPkce = new URL(agent.authorizationUrl!);
    noPkce.searchParams.delete("code_challenge");
    noPkce.searchParams.delete("code_challenge_method");
    const r1 = await fetch(noPkce, { headers: { cookie: owner.cookie, accept: "text/html" }, redirect: "manual" });
    expect(r1.headers.get("location") ?? "").not.toContain("/oauth/consent");

    const elsewhere = new URL(agent.authorizationUrl!);
    elsewhere.searchParams.set("resource", "https://other.example.com/mcp");
    const r2 = await fetch(elsewhere, { headers: { cookie: owner.cookie, accept: "text/html" }, redirect: "manual" });
    expect(r2.headers.get("location") ?? "").not.toContain("/oauth/consent");

    const { location } = await openAuthorize(agent, owner.cookie);
    const cancel = await answerConsent(base, owner.cookie, location!, { accept: false });
    expect(((await cancel.json()) as { url: string }).url).toContain("error=access_denied");
    expect(await db.select().from(agentConnections).where(eq(agentConnections.clientName, "Careless Agent"))).toHaveLength(0);
  });

  it("the consent page's details come from the signed request: the agent, the person and their role, and drafts only when allowed", async () => {
    const agent = new TestAgent("Consent Agent");
    const pending = mcpClient(base, agent);
    await pending.client.connect(pending.transport).catch(() => {});
    const { location } = await openAuthorize(agent, staff.cookie);
    const query = new URL(location!).search.slice(1);

    const info = (await (await call(staff, "GET", `/agent-consent?${query}`)).json()) as { off: boolean; agent: { name: string; verified: boolean; host: string }; person: { name: string; role: string }; draftsOffered: boolean };
    expect(info).toMatchObject({ off: false, agent: { name: "Consent Agent", verified: false, host: "localhost:47999" }, person: { name: "Kavya Iyer", role: "staff" }, draftsOffered: true });

    // Before sign-in, only the agent (for "<Agent> is asking to connect").
    expect(await (await fetch(`${base}/agent-consent/agent?${query}`)).json()).toMatchObject({ name: "Consent Agent", verified: false });

    // With drafts off for everyone, the box isn't offered.
    expect((await call(owner, "PUT", "/org/agents", { drafts: false })).status).toBe(200);
    expect(((await (await call(staff, "GET", `/agent-consent?${query}`)).json()) as { draftsOffered: boolean }).draftsOffered).toBe(false);
    expect((await call(owner, "PUT", "/org/agents", { drafts: true })).status).toBe(200);

    // Anything not signed by Spine is refused.
    const tampered = query.replace("Consent", "Evil");
    expect((await call(staff, "GET", `/agent-consent?${query.replace(/client_id=[^&]+/, "client_id=someone-else")}`)).status).toBe(400);
    expect((await fetch(`${base}/agent-consent/agent?${tampered}x=1`)).status).toBe(400);
    expect((await fetch(`${base}/agent-consent/agent`)).status).toBe(400);
  });

  it("refuses a token Spine didn't issue for /mcp — a session JWT isn't an MCP token", async () => {
    const minted = ((await (await fetch(`${base}/api/auth/token`, { headers: { cookie: owner.cookie } })).json()) as { token: string }).token;
    expect((await rpc(minted, listTools)).status).toBe(401);
    expect((await rpc("not-a-token", listTools)).status).toBe(401);
  });

  it("while Connected agents is off, /mcp answers MODULE_OFF and Allow is refused; back on, the agent works again", async () => {
    const agent = new TestAgent("Switch Agent");
    const client = await connectAgent(base, owner.cookie, agent);
    const token = agent.tokens()!.access_token;
    expect((await call(owner, "PUT", "/org/agents", { enabled: false })).status).toBe(200);

    const off = await rpc(token, listTools);
    expect(off.status).toBe(403);
    const body = (await off.json()) as { error: string; message: string };
    expect(body.error).toBe("MODULE_OFF");
    expect(body.message).toMatch(/^Connected agents are turned off for .+\. Ask an Owner to turn them on\.$/);

    const another = new TestAgent("Too Late Agent");
    const pending = mcpClient(base, another);
    await pending.client.connect(pending.transport).catch(() => {});
    const { location } = await openAuthorize(another, owner.cookie);
    expect((await answerConsent(base, owner.cookie, location!, { accept: true })).status).toBe(403);

    expect((await call(owner, "PUT", "/org/agents", { enabled: true })).status).toBe(200);
    expect((await rpc(token, listTools)).status).toBe(200);
    await client.close();
  });

  it("deactivating the person ends their connections at once; reactivating doesn't restore them", async () => {
    const agent = new TestAgent("Staff Agent");
    await connectAgent(base, staff.cookie, agent);
    const token = agent.tokens()!.access_token;
    expect((await rpc(token, listTools)).status).toBe(200);
    const [staffMember] = await db.select().from(member).where(eq(member.userId, staff.userId));
    expect((await call(owner, "PUT", `/org/members/${staffMember!.id}/deactivate`)).status).toBeLessThan(300);
    const after = await rpc(token, listTools);
    expect(after.status).toBe(401);
    expect(after.headers.get("www-authenticate")).toContain('error="invalid_token"');
    expect(await db.select().from(agentConnections).where(and(eq(agentConnections.userId, staff.userId), isNull(agentConnections.endedAt)))).toHaveLength(0);
    expect((await call(owner, "PUT", `/org/members/${staffMember!.id}/reactivate`)).status).toBeLessThan(300);
    expect((await rpc(token, listTools)).status).toBe(401);
  });

  it("a password reset ends every connection the person has", async () => {
    const agent = new TestAgent("Reset Agent");
    await connectAgent(base, owner.cookie, agent);
    const token = agent.tokens()!.access_token;
    await db.delete(verification).where(eq(verification.value, owner.userId));
    const [ownerUser] = await db.select().from(member).where(eq(member.userId, owner.userId));
    expect(ownerUser).toBeTruthy();
    const email = ((await (await fetch(`${base}/api/auth/get-session`, { headers: { cookie: owner.cookie } })).json()) as { user: { email: string } }).user.email;
    await fetch(`${base}/api/auth/request-password-reset`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.77.0.1" }, body: JSON.stringify({ email }) });
    const [row] = await db.select().from(verification).where(and(eq(verification.value, owner.userId), like(verification.identifier, "reset-password:%")));
    const resetToken = row!.identifier.slice("reset-password:".length);
    const reset = await fetch(`${base}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, newPassword: "a-brand-new-password-77" }) });
    expect(reset.status).toBe(200);
    expect((await rpc(token, listTools)).status).toBe(401);
    expect(await db.select().from(agentConnections).where(and(eq(agentConnections.userId, owner.userId), isNull(agentConnections.endedAt)))).toHaveLength(0);
  });
});
