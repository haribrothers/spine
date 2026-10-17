import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AI_FEATURE_OFF_ERROR, aiPausedMessage, type AiSettings, type AiStatus, type AiUsage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { aiRequests, auditLog, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../test-utils/ai-stub";
import { orgClock } from "../../common/org-clock";
import { NotificationsService } from "../notifications/notifications.service";
import { AiRequestService, type AiCall } from "./ai-request.service";
import { AiHttp } from "./drivers";

type Who = { cookie: string; userId: string };

/** US-AI-03, US-AI-04 — feature switches, the monthly budget and usage. Requires local Postgres. */
describe("US-AI-03 · US-AI-04 (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let requests: AiRequestService;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  /** One request through the gateway, as a feature makes it: a real call to the stand-in provider, with the tokens it "used". */
  const ask = (feature: AiCall["feature"], tokens: { input: number; output: number }, userId = owner.userId) =>
    requests.run({ orgId, userId, feature }, async (driver, model) => {
      await driver.ping(model, false);
      return { value: "OK", usage: tokens };
    });
  const failure = async (p: Promise<unknown>) => {
    const err = (await p.then(() => null, (e: unknown) => e)) as { getStatus(): number; getResponse(): { error: string; message: string } } | null;
    expect(err, "expected the request to be refused").not.toBeNull();
    return { status: err!.getStatus(), ...err!.getResponse() };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-03-${name}-${randomUUID()}@example.com`, password: "testpassword123", name: name === "owner" ? "Priya Raman" : "Kavya Iyer" }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    stub = await startAiStub();
    requests = testApp.app.get(AiRequestService);
    await json(await call(owner, "PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "llama3.2-vision", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stub?.close();
    await testApp?.close();
  });

  describe("US-AI-03", () => {
    it("every feature starts on, and members' screens can see which are", async () => {
      expect((await json<AiSettings>(await call(owner, "GET", "/org/ai"))).features).toEqual({ readDocuments: true, draftEmails: true, draftQuoteLines: true, bankSuggestions: true });
      expect((await json<AiStatus>(await call(staff, "GET", "/ai/status"))).features.draftEmails).toBe(true);
    });

    it("a feature switched off is refused with AI_FEATURE_OFF before anything is sent, and the switch is audited", async () => {
      const off = await json<AiSettings>(await call(owner, "PUT", "/org/ai", { features: { draftEmails: false } }));
      expect(off.features).toMatchObject({ draftEmails: false, readDocuments: true });
      expect((await json<AiStatus>(await call(staff, "GET", "/ai/status"))).features.draftEmails).toBe(false);

      const http = vi.spyOn(testApp.app.get(AiHttp), "json");
      const refused = await failure(ask("draftEmails", { input: 10, output: 1 }));
      expect(refused).toMatchObject({ status: 403, error: AI_FEATURE_OFF_ERROR, message: "Draft customer emails is switched off in Settings › AI assistant." });
      expect(http).not.toHaveBeenCalled();
      expect(await ask("readDocuments", { input: 0, output: 0 })).toBe("OK");
      http.mockRestore();

      const audit = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "ai_settings")));
      expect(audit.flatMap((a) => a.changes as unknown[])).toContainEqual({ field: "Draft customer emails", from: "On", to: "Off" });
      await json(await call(owner, "PUT", "/org/ai", { features: { draftEmails: true } }));
    });
  });

  describe("US-AI-04", () => {
    it("rejects a budget that isn't a whole number of at least 1,000 tokens", async () => {
      const res = await call(owner, "PUT", "/org/ai", { monthlyTokenBudget: 10 });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("Enter at least 1,000 tokens, or leave it empty for no limit.");
    });

    it("tells Owners once at 80%, pauses AI at 100% until the 1st, and shows usage with the top features and people", async () => {
      await db.delete(aiRequests).where(eq(aiRequests.orgId, orgId));
      await json(await call(owner, "PUT", "/org/ai", { monthlyTokenBudget: 1_000 }));
      const notify = vi.spyOn(testApp.app.get(NotificationsService), "notify").mockResolvedValue();

      await ask("readDocuments", { input: 700, output: 150 }); // 85%
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify.mock.calls[0]![1]).toMatchObject({ subject: "AI has used 80% of this month's budget.", recipientRoles: ["owner"], inApp: { type: "ai_budget_warning" } });
      await ask("draftQuoteLines", { input: 50, output: 20 }, staff.userId); // 92%: no second warning
      expect(notify).toHaveBeenCalledTimes(1);

      await ask("readDocuments", { input: 90, output: 10 }); // 102%: paused
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify.mock.calls[1]![1]).toMatchObject({ inApp: { type: "ai_budget_reached" } });

      const month = orgClock().date.slice(0, 7);
      const [y, m] = month.split("-").map(Number) as [number, number];
      const firstOfNext = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const paused = await failure(ask("readDocuments", { input: 1, output: 1 }));
      expect(paused).toMatchObject({ status: 409, error: "AI_BUDGET_USED", message: aiPausedMessage(firstOfNext) });
      expect((await json<AiStatus>(await call(staff, "GET", "/ai/status"))).pausedUntil).toBe(firstOfNext);
      expect(notify).toHaveBeenCalledTimes(2);

      const usage = await json<AiUsage>(await call(owner, "GET", "/org/ai/usage"));
      expect(usage).toMatchObject({ month, budget: 1_000, used: 1_020, requests: 3, percent: 102, pausedUntil: firstOfNext });
      expect(usage.byFeature[0]).toMatchObject({ feature: "readDocuments", tokens: 950 });
      expect(usage.byUser.map((u) => u.name)).toEqual(["Priya Raman", "Kavya Iyer"]);
      notify.mockRestore();

      // Raising the budget lifts the pause at once.
      await json(await call(owner, "PUT", "/org/ai", { monthlyTokenBudget: 5_000 }));
      expect((await json<AiStatus>(await call(staff, "GET", "/ai/status"))).pausedUntil).toBeNull();
    });

    it("stops a person after 30 requests in 10 minutes, without counting the refusals", async () => {
      await json(await call(owner, "PUT", "/org/ai", { monthlyTokenBudget: null }));
      const base = { orgId, userId: staff.userId, feature: "draft_email" as const, provider: "x", model: "y", outcome: "ok" as const };
      await db.insert(aiRequests).values(Array.from({ length: 30 }, () => base));
      const refused = await failure(ask("readDocuments", { input: 1, output: 1 }, staff.userId));
      expect(refused).toMatchObject({ status: 429, error: "AI_RATE_LIMIT", message: "Too many AI requests. Try again in a few minutes." });
      // The Owner isn't affected by Kavya's requests.
      expect(await ask("readDocuments", { input: 1, output: 1 })).toBe("OK");
      const rows = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.outcome, "rate_limited")));
      expect(rows).toHaveLength(1);
    });

    it("usage is the Owner's alone", async () => {
      expect((await call(staff, "GET", "/org/ai/usage")).status).toBe(403);
      expect((await call(owner, "GET", "/org/ai/usage?month=2026-13")).status).toBe(400);
    });
  });
});
