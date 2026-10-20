import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgentsSettings } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-MCP-02 (D-256, D-258) — the Owner's switch for connected agents. Requires local Postgres. */
describe("US-MCP-02 · switch connected agents on or off (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const audit = () => db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "agents_settings")));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-mcp-02-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("starts off, with drafts allowed and the connector address, and Modules doesn't count it as on", async () => {
    const s = await json<AgentsSettings>(await call(owner, "GET", "/org/agents"));
    expect(s).toMatchObject({ enabled: false, drafts: true });
    expect(s.mcpUrl).toMatch(/\/mcp$/);
    expect(s.mcpUrl.startsWith((process.env.API_URL ?? "http://localhost").replace(/\/+$/, ""))).toBe(true);
    expect(await json(await call(owner, "GET", "/org/modules"))).not.toHaveProperty("agents");
  });

  it("an Owner switches it on and off; each change is in the audit log and Modules follows", async () => {
    expect(await json<AgentsSettings>(await call(owner, "PUT", "/org/agents", { enabled: true }))).toMatchObject({ enabled: true });
    expect(await json(await call(owner, "GET", "/org/modules"))).toMatchObject({ agents: true });
    expect(await json<AgentsSettings>(await call(owner, "PUT", "/org/agents", { enabled: false }))).toMatchObject({ enabled: false });
    expect(await json(await call(owner, "GET", "/org/modules"))).not.toHaveProperty("agents");
    const changes = (await audit()).flatMap((e) => e.changes as unknown[]);
    expect(changes).toContainEqual({ field: "Connected agents", from: "Off", to: "On" });
    expect(changes).toContainEqual({ field: "Connected agents", from: "On", to: "Off" });
  });

  it("\"Agents can create drafts\" switches on its own and is audited; nothing changed records nothing", async () => {
    expect(await json<AgentsSettings>(await call(owner, "PUT", "/org/agents", { drafts: false }))).toMatchObject({ drafts: false, enabled: false });
    expect((await audit()).flatMap((e) => e.changes as unknown[])).toContainEqual({ field: "Agents can create drafts", from: "On", to: "Off" });
    const before = (await audit()).length;
    await json(await call(owner, "PUT", "/org/agents", { drafts: false }));
    expect((await audit()).length).toBe(before);
    const empty = await call(owner, "PUT", "/org/agents", {});
    expect(empty.status).toBe(400);
  });

  it("is Owner-only, and the generic settings routes can't read or write it", async () => {
    expect((await call(staff, "GET", "/org/agents")).status).toBe(403);
    expect((await call(staff, "PUT", "/org/agents", { enabled: true })).status).toBe(403);
    expect((await call(owner, "GET", "/org/settings/agents")).status).toBe(403);
    expect((await call(owner, "PUT", "/org/settings/agents", { value: { enabled: true } })).status).toBe(403);
    expect(await json(await call(owner, "GET", "/org/settings"))).not.toHaveProperty("agents");
  });
});
