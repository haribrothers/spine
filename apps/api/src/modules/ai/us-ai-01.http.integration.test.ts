import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AI_CONNECT_PROVIDER_FIRST, MODULE_OFF_ERROR, aiAcknowledgeFirst, type AiSettings } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../test-utils/ai-stub";
import { AiHttp } from "./drivers";

type Who = { cookie: string; userId: string };

/** US-AI-01 — switch the AI assistant on or off. Requires local Postgres. */
describe("US-AI-01 · switch the AI assistant on or off (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  let providerCalls: { mock: { calls: unknown[] } };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const aiAudit = () => db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "ai_settings")));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-01-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    stub = await startAiStub();
    providerCalls = vi.spyOn(testApp.app.get(AiHttp), "json");
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stub?.close();
    await testApp?.close();
  });

  it("starts off on a new install, and Modules doesn't count it as on", async () => {
    expect(await json<AiSettings>(await call(owner, "GET", "/org/ai"))).toMatchObject({ enabled: false, driver: "none", providerHost: null });
    expect(await json(await call(owner, "GET", "/org/modules"))).not.toHaveProperty("ai");
  });

  it("can't be switched on with no provider connected", async () => {
    const res = await call(owner, "PUT", "/org/ai", { enabled: true });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe(AI_CONNECT_PROVIDER_FIRST);
    expect((await json<AiSettings>(await call(owner, "GET", "/org/ai"))).enabled).toBe(false);
  });

  it("while off, AI routes answer 403 MODULE_OFF and nothing reaches the provider", async () => {
    await json(await call(owner, "PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "llama3.2-vision" }));
    const res = await call(owner, "GET", "/ai/status");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe(MODULE_OFF_ERROR);
    expect(providerCalls).not.toHaveBeenCalled();
    expect(stub.requests).toHaveLength(0);
  });

  it("a provider on the local network switches on without asking, and Modules says it's on", async () => {
    const on = await json<AiSettings>(await call(owner, "PUT", "/org/ai", { enabled: true }));
    expect(on).toMatchObject({ enabled: true, local: true, providerHost: new URL(stub.url).host });
    expect(await json(await call(owner, "GET", "/org/modules"))).toMatchObject({ ai: true });
    expect((await call(owner, "GET", "/ai/status")).status).toBe(200);
    expect((await aiAudit()).flatMap((e) => e.changes as unknown[])).toContainEqual({ field: "AI assistant", from: "Off", to: "On" });
  });

  it("moving to a provider outside the local network needs the acknowledgement, which is audited", async () => {
    const refused = await call(owner, "PUT", "/org/ai", { baseUrl: "https://llm.example.com/v1" });
    expect(refused.status).toBe(400);
    expect(await message(refused)).toBe(aiAcknowledgeFirst("llm.example.com"));
    expect((await json<AiSettings>(await call(owner, "GET", "/org/ai"))).providerHost).toBe(new URL(stub.url).host);

    const moved = await json<AiSettings>(await call(owner, "PUT", "/org/ai", { baseUrl: "https://llm.example.com/v1", acknowledged: true }));
    expect(moved).toMatchObject({ enabled: true, local: false, providerHost: "llm.example.com" });
    const changes = (await aiAudit()).flatMap((e) => e.changes as { field: string; to: string }[]);
    expect(changes).toContainEqual({ field: "Sends business data to", from: "", to: "llm.example.com" });
  });

  it("switching off is audited, and the AI routes close again", async () => {
    const off = await json<AiSettings>(await call(owner, "PUT", "/org/ai", { enabled: false }));
    expect(off.enabled).toBe(false);
    expect((await call(owner, "GET", "/ai/status")).status).toBe(403);
    const changes = (await aiAudit()).flatMap((e) => e.changes as { field: string; to: string }[]);
    expect(changes).toContainEqual({ field: "AI assistant", from: "On", to: "Off" });
    // Back on with the provider already acknowledged: no second question.
    expect((await json<AiSettings>(await call(owner, "PUT", "/org/ai", { enabled: true }))).enabled).toBe(true);
    await json(await call(owner, "PUT", "/org/ai", { enabled: false }));
    expect(providerCalls).not.toHaveBeenCalled();
  });

  it("a Staff user can't read or change the AI settings, here or through the generic settings routes", async () => {
    expect((await call(staff, "GET", "/org/ai")).status).toBe(403);
    expect((await call(staff, "PUT", "/org/ai", { enabled: true })).status).toBe(403);
    expect((await call(staff, "GET", "/org/settings/ai")).status).toBe(403);
    expect(await json(await call(staff, "GET", "/org/settings"))).not.toHaveProperty("ai");
    expect((await call(owner, "PUT", "/org/settings/ai", { value: { enabled: true } })).status).toBe(403);
  });
});
