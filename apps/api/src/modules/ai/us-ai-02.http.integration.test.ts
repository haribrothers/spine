import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AiSettings, AiTestResult } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, member, settings } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../test-utils/ai-stub";
import { SECRET_SETTING } from "../data-export/data-export.tables";
import { AI_KEY_SETTING } from "./ai-settings.service";
import { AiHttp } from "./drivers";

type Who = { cookie: string; userId: string };

/** US-AI-02 — connect a local or cloud AI provider. Requires local Postgres. */
describe("US-AI-02 · connect a local or cloud AI provider (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let vision: AiStub;
  let textOnly: AiStub;
  const owner: Who = { cookie: "", userId: "" };
  const KEY = "sk-ant-test-0000000000001a2b";

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-ai-02-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    vision = await startAiStub({ models: ["llama3.2-vision", "qwen2.5:14b"] });
    textOnly = await startAiStub({ models: ["qwen2.5:14b"], acceptsImages: false });
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await vision?.close();
    await textOnly?.close();
    await testApp?.close();
  });

  it("Test connection lists the models and says the model reads images", async () => {
    const result = await json<AiTestResult>(await call("POST", "/org/ai/test", { driver: "openai-compatible", baseUrl: vision.url, model: "llama3.2-vision" }));
    expect(result).toEqual({ ok: true, model: "llama3.2-vision", supportsImages: true, models: ["llama3.2-vision", "qwen2.5:14b"] });
    const chat = vision.requests.find((r) => r.path === "/v1/chat/completions")!;
    expect(chat.body).toMatchObject({ model: "llama3.2-vision", max_tokens: 1 });
  });

  it("a model that refuses images is still connected, reading images: no — and the saved provider remembers it", async () => {
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: textOnly.url, model: "qwen2.5:14b" }));
    const result = await json<AiTestResult>(await call("POST", "/org/ai/test", { driver: "openai-compatible", baseUrl: textOnly.url, model: "qwen2.5:14b" }));
    expect(result).toMatchObject({ ok: true, supportsImages: false });
    expect((await json<AiSettings>(await call("GET", "/org/ai"))).supportsImages).toBe(false);
  });

  it("an address that doesn't answer says so and what to do next", async () => {
    // A port that was free a moment ago: nothing listens there.
    const gone = await startAiStub();
    await gone.close();
    const result = await json<AiTestResult>(await call("POST", "/org/ai/test", { driver: "openai-compatible", baseUrl: gone.url, model: "x" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBe(`Couldn't reach ${gone.url}: the connection was refused. Check the address and key, then try again.`);
  });

  it("the Model picker lists what the provider reports", async () => {
    expect(await json(await call("POST", "/org/ai/models", { driver: "openai-compatible", baseUrl: vision.url }))).toEqual({ models: ["llama3.2-vision", "qwen2.5:14b"] });
  });

  it("an Anthropic key is stored sealed, shown only as its last four characters, never exported, and audited without it", async () => {
    const saved = await json<AiSettings>(await call("PUT", "/org/ai", { driver: "anthropic", apiKey: KEY, model: "claude-sonnet-5-5" }));
    expect(saved).toMatchObject({ driver: "anthropic", apiKeyHint: "1a2b", providerHost: "api.anthropic.com", local: false, baseUrl: null });
    expect(JSON.stringify(await json(await call("GET", "/org/ai")))).not.toContain(KEY);

    const rows = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, AI_KEY_SETTING)));
    expect(JSON.stringify(rows[0]!.value)).not.toContain(KEY);
    expect(SECRET_SETTING.test(AI_KEY_SETTING)).toBe(true);
    expect(JSON.stringify(await json(await call("GET", "/org/settings")))).not.toContain(AI_KEY_SETTING);

    const audit = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "ai_settings")));
    expect(JSON.stringify(audit.map((a) => a.changes))).not.toContain(KEY);
    expect(audit.flatMap((a) => a.changes as { field: string; to: string }[])).toContainEqual({ field: "API key", from: "", to: "••••1a2b" });
  });

  it("Test connection with Anthropic sends the saved key to api.anthropic.com only", async () => {
    const http = vi.spyOn(testApp.app.get(AiHttp), "json").mockImplementation(async (url: string) => (url.endsWith("/models?limit=100") ? { data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }] } : { content: [{ type: "text", text: "OK" }] }) as never);
    const result = await json<AiTestResult>(await call("POST", "/org/ai/test", { driver: "anthropic", model: "claude-sonnet-5-5" }));
    expect(result).toEqual({ ok: true, model: "claude-sonnet-5-5", supportsImages: true, models: ["claude-sonnet-5-5", "claude-haiku-5-5"] });
    for (const [url, init] of http.mock.calls as [string, { headers: Record<string, string> }][]) {
      expect(new URL(url).host).toBe("api.anthropic.com");
      expect(init.headers["x-api-key"]).toBe(KEY);
    }
    http.mockRestore();
  });

  it("a saved key isn't sent to a different provider", async () => {
    const http = vi.spyOn(testApp.app.get(AiHttp), "json");
    await json(await call("POST", "/org/ai/test", { driver: "openai-compatible", baseUrl: vision.url, model: "llama3.2-vision" }));
    for (const [, init] of http.mock.calls as [string, { headers: Record<string, string> }][]) expect(init.headers.Authorization).toBeUndefined();
    http.mockRestore();
  });
});
