import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AI_TIMEOUT_ERROR, AI_UNAVAILABLE_ERROR, AI_UNAVAILABLE_MESSAGE } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, aiRequests, expenseCategories, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../test-utils/ai-stub";
import { AiRequestService } from "./ai-request.service";

type Who = { cookie: string; userId: string };

/** US-AI-07 — AI never blocks work: a provider that fails or hangs is "AI didn't answer…", and forms save by hand. Requires local Postgres. */
describe("US-AI-07 (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let requests: AiRequestService;
  const owner: Who = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const ask = () =>
    requests.run({ orgId, userId: owner.userId, feature: "readDocuments" }, async (driver, model) => {
      await driver.ping(model, false);
      return { value: "OK", usage: { input: 10, output: 1 } };
    });
  const failure = async (p: Promise<unknown>) => {
    const err = (await p.then(() => null, (e: unknown) => e)) as { getStatus(): number; getResponse(): { error: string; message: string } } | null;
    expect(err, "expected AI not to answer").not.toBeNull();
    return { status: err!.getStatus(), ...err!.getResponse() };
  };
  const chats = () => stub.requests.filter((r) => r.path === "/v1/chat/completions").length;
  const lastOutcome = async () => (await db.select().from(aiRequests).where(eq(aiRequests.orgId, orgId)).orderBy(desc(aiRequests.createdAt)).limit(1))[0]?.outcome;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-ai-07-${randomUUID()}@example.com`, password: "testpassword123", name: "Priya Raman" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    stub = await startAiStub();
    requests = testApp.app.get(AiRequestService);
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stub?.close();
    await testApp?.close();
  });

  it("a provider that doesn't answer in time is 504 \"AI didn't answer…\", asked once", async () => {
    stub.setMode("hang");
    // The real 30-second limit, shortened so the test doesn't wait for it.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(300));
    const before = chats();
    expect(await failure(ask())).toMatchObject({ status: 504, error: AI_TIMEOUT_ERROR, message: AI_UNAVAILABLE_MESSAGE });
    expect(chats() - before).toBe(1);
    expect(await lastOutcome()).toBe("timeout");
    timeout.mockRestore();
  });

  it("a provider that fails is 503 \"AI didn't answer…\" and isn't retried", async () => {
    stub.setMode("down");
    const before = chats();
    expect(await failure(ask())).toMatchObject({ status: 503, error: AI_UNAVAILABLE_ERROR, message: AI_UNAVAILABLE_MESSAGE });
    expect(chats() - before).toBe(1);
    expect(await lastOutcome()).toBe("error");
  });

  it("a provider that can't be reached is 503 too", async () => {
    const gone = await startAiStub();
    await gone.close();
    await json(await call("PUT", "/org/ai", { baseUrl: gone.url }));
    expect(await failure(ask())).toMatchObject({ status: 503, error: AI_UNAVAILABLE_ERROR, message: AI_UNAVAILABLE_MESSAGE });
  });

  it("with the provider down, bills and expenses save by hand as normal", async () => {
    const vendor = await json<{ id: string }>(await call("POST", "/contacts", { type: "vendor", name: "Ridgeline Equipment Rentals" }));
    const bill = await call("POST", "/vendor-bills", { contactId: vendor.id, billNumber: "RTE-3318", date: "2026-10-16", dueDate: "2026-11-05", currency: "USD", lines: [] });
    expect(bill.status).toBe(201);
    expect(((await bill.json()) as { aiAssisted: boolean }).aiAssisted).toBe(false);

    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Equipment", accountId: other!.id }).returning();
    expect((await call("POST", "/expenses", { categoryId: category!.id, date: "2026-10-16", currency: "USD", amount: "12000" })).status).toBe(201);
  });
});
