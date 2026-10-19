import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_NOT_ALLOWED_MESSAGE, auditDetails, type AiStatus, type AuditLogPage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, member, session as sessionTable, teamPrivileges } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../test-utils/ai-stub";
import { AiRequestService, type AiCall } from "./ai-request.service";

type Who = { cookie: string; userId: string };

/** US-AI-05, US-AI-06 — who may use AI, and the record of every request. Requires local Postgres. */
describe("US-AI-05 · US-AI-06 (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let requests: AiRequestService;
  let teamId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const ask = (who: Who, extra: Partial<AiCall> = {}) =>
    requests.run({ orgId, userId: who.userId, feature: "readDocuments", ...extra }, async (driver, model) => {
      await driver.ping(model, false);
      return { value: "OK", usage: { input: 3_000, output: 412 } };
    });
  const refusal = async (p: Promise<unknown>) => {
    const err = (await p.then(() => null, (e: unknown) => e)) as { getStatus(): number; message: string } | null;
    expect(err, "expected a refusal").not.toBeNull();
    return { status: err!.getStatus(), message: err!.message };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [fieldUser, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-05-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    const teams = await json<{ id: string; isDefault: boolean }[]>(await call(owner, "GET", "/org/teams"));
    teamId = teams.find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call(owner, "PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));
    stub = await startAiStub();
    requests = testApp.app.get(AiRequestService);
    await json(await call(owner, "PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    await stub?.close();
    await testApp?.close();
  });

  describe("US-AI-05", () => {
    it("General Staff starts without \"Use AI features\", so Staff see no AI and are refused", async () => {
      const [grant] = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, teamId), eq(teamPrivileges.capability, "ai.use")));
      expect(grant?.granted ?? false).toBe(false);
      expect(await json<AiStatus>(await call(staff, "GET", "/ai/status"))).toMatchObject({ canUse: false, canReadOwnReceipt: false });
      expect(await refusal(ask(staff))).toEqual({ status: 403, message: AI_NOT_ALLOWED_MESSAGE });
    });

    it("an Owner gives the Team the right; its Staff then use AI, and an Owner always may", async () => {
      await json(await call(owner, "PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "ai.use", granted: true }] }));
      const caps = await json<Record<string, boolean>>(await call(staff, "GET", "/org/members/me/capabilities"));
      expect(caps["ai.use"]).toBe(true);
      expect((await json<AiStatus>(await call(staff, "GET", "/ai/status"))).canUse).toBe(true);
      expect(await ask(staff)).toBe("OK");
      expect(await ask(owner)).toBe("OK");
    });

    it("Field may only read the receipt on their own expense", async () => {
      expect(await json<AiStatus>(await call(fieldUser, "GET", "/ai/status"))).toMatchObject({ canUse: false, canReadOwnReceipt: true });
      expect(await ask(fieldUser, { fieldOwnReceipt: true })).toBe("OK");
      expect((await refusal(ask(fieldUser))).status).toBe(403);
      expect((await refusal(ask(fieldUser, { feature: "draftEmails", fieldOwnReceipt: true }))).status).toBe(403);
    });

    it("with AI off, the right is kept but not usable", async () => {
      await json(await call(owner, "PUT", "/org/ai", { enabled: false }));
      const caps = await json<Record<string, boolean>>(await call(staff, "GET", "/org/members/me/capabilities"));
      expect(caps["ai.use"]).toBe(false);
      const [grant] = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, teamId), eq(teamPrivileges.capability, "ai.use")));
      expect(grant!.granted).toBe(true);
      await json(await call(owner, "PUT", "/org/ai", { enabled: true }));
      expect((await json<Record<string, boolean>>(await call(staff, "GET", "/org/members/me/capabilities")))["ai.use"]).toBe(true);
    });
  });

  describe("US-AI-06", () => {
    let contactId: string;

    it("every AI request is in the audit log as an AI request, naming and opening its record, without the text", async () => {
      contactId = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "vendor", name: "Apex Building Materials" }))).id;
      const bill = await json<{ id: string }>(await call(owner, "POST", "/vendor-bills", { contactId, billNumber: "ABM-20611", date: "2026-10-14", currency: "USD", lines: [] }));
      await ask(owner, { entityType: "vendor_bill", entityId: bill.id });

      const page = await json<AuditLogPage>(await call(owner, "GET", "/org/audit-log?entityType=ai_request"));
      const entry = page.entries.find((e) => e.recordLabel === "Vendor bill · ABM-20611")!;
      expect(entry).toMatchObject({ action: "read_document", entityType: "ai_request", link: `/vendor-bills/${bill.id}`, actor: { name: "Priya Raman" } });
      expect(auditDetails(entry)).toBe(`${new URL(stub.url).host} · qwen3-vl:8b · 3,412 tokens · Worked`);
      expect(page.facets.entityTypes).toContain("ai_request");
      expect(JSON.stringify(entry.changes)).not.toMatch(/Reply with OK/);
    });

    it("a bill, expense or quote saved from AI says so in its Activity", async () => {
      const bill = await json<{ id: string; aiAssisted: boolean }>(await call(owner, "POST", "/vendor-bills", { contactId, billNumber: "ABM-20612", date: "2026-10-14", currency: "USD", lines: [], aiAssisted: true }));
      expect(bill.aiAssisted).toBe(true);
      const billActivity = await json<{ type: string; aiAssisted?: true }[]>(await call(owner, "GET", `/vendor-bills/${bill.id}/activity`));
      expect(billActivity.find((e) => e.type === "created")).toMatchObject({ aiAssisted: true });

      const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
      const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel", accountId: other!.id }).returning();
      const expense = await json<{ id: string }>(await call(owner, "POST", "/expenses", { categoryId: category!.id, date: "2026-10-13", currency: "USD", amount: "4850", aiAssisted: true }));
      const expenseActivity = await json<{ type: string; aiAssisted?: true }[]>(await call(owner, "GET", `/expenses/${expense.id}/activity`));
      expect(expenseActivity.find((e) => e.type === "submitted")).toMatchObject({ aiAssisted: true });

      const customer = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Ananya Rao", email: "ananya@example.com" }));
      const quote = await json<{ id: string }>(await call(owner, "POST", "/quotes", { contactId: customer.id, currency: "USD", lines: [{ name: "Demolition", quantity: 1, unitPriceAmount: "1800000" }] }));
      await json(await call(owner, "PUT", `/quotes/${quote.id}`, { lines: [{ name: "Demolition", quantity: 1, unitPriceAmount: "1800000" }, { name: "Waterproofing", quantity: 42, unitPriceAmount: "42000" }], aiAssisted: true }));
      const quoteActivity = await json<{ type: string; aiAssisted?: true }[]>(await call(owner, "GET", `/quotes/${quote.id}/activity`));
      expect(quoteActivity.find((e) => e.type === "created")!.aiAssisted).toBeUndefined();
      expect(quoteActivity.find((e) => e.type === "edited")).toMatchObject({ aiAssisted: true });
    });
  });
});
