import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReceiptSuggestion } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { accounts, aiRequests, expenseCategories, member, session as sessionTable } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";
import { billPhoto, textBillPdf } from "../../../test-utils/bill-documents";

type Who = { cookie: string; userId: string };

/** US-AI-09 — reading a receipt into the expense form. The provider is a stand-in; Spine's matching is real. Requires local Postgres. */
describe("US-AI-09 (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let fuel: string;
  let materials: string;
  let igst18: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const call = callAs(owner);
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const upload = async (bytes: Buffer, type: string, name: string, who: Who = owner) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
    return (await json<{ id: string }>(await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form }))).id;
  };
  const read = (fileId: string, who: Who = owner) => callAs(who)("POST", "/ai/read-document", { fileId, target: "expense" });
  const receipt = () => upload(textBillPdf(["HP FUEL CENTRE", "NH-44, Hosur Road", "HSD diesel 52.4 L x 92.56 4,850.00", "CGST 9% 369.92 SGST 9% 369.91"]), "application/pdf", "diesel-13-oct.pdf");
  const lastChat = () => stub.requests.filter((r) => r.path === "/v1/chat/completions").at(-1)!.body as { messages: { content: unknown }[] };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [fieldUser, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-09-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    const teams = await json<{ id: string; isDefault: boolean }[]>(await call("GET", "/org/teams"));
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call("PUT", `/org/teams/${teams.find((t) => t.isDefault)!.id}/members`, { memberIds: [staffMember.id] }));

    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors" }));
    igst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-rates"))).find((r) => r.name === "IGST 18%")!.id;
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const created = await db
      .insert(expenseCategories)
      .values([
        { orgId, name: "Fuel & freight", description: "Diesel, petrol and transport", accountId: other!.id },
        { orgId, name: "Materials", description: "Timber, screws, cement and other site materials", accountId: other!.id },
      ])
      .returning();
    fuel = created[0]!.id;
    materials = created[1]!.id;
    // Priya's last three expenses at HP Fuel Centre went to Fuel & freight.
    for (const day of ["2026-10-01", "2026-10-05", "2026-10-09"]) {
      await json(await call("POST", "/expenses", { categoryId: fuel, date: day, currency: "INR", amount: "300000", description: "HP Fuel Centre — diesel" }));
    }

    stub = await startAiStub();
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    await stub?.close();
    await testApp?.close();
  });

  it("reads a receipt: amount, date, currency, the receipt's tax with a rate matched by percentage, and the category this merchant's expenses used", async () => {
    stub.setReply(
      JSON.stringify({
        merchant: "HP FUEL CENTRE",
        whatWasBought: "HSD diesel, 52.4 L",
        date: "2026-10-13",
        currency: "INR",
        total: "4,850.00",
        taxAmount: 739.83,
        taxPercent: 18,
        taxLines: [{ name: "CGST 9%", amount: 369.92 }, { name: "SGST 9%", amount: "369.91" }, { name: "", amount: 1 }],
        category: "Materials",
      }),
    );
    const suggestion = await json<ReceiptSuggestion>(await read(await receipt()));
    expect(suggestion).toMatchObject({
      merchant: "HP FUEL CENTRE",
      description: "HP FUEL CENTRE — HSD diesel, 52.4 L",
      date: "2026-10-13",
      currency: "INR",
      amount: "485000",
      taxAmount: "73983",
      taxPercent: 18,
      // India's GST is CGST + SGST groups; an expense takes one rate, so the 18% IGST rate.
      taxRateId: igst18,
      taxLines: [
        { name: "CGST 9%", amount: "36992" },
        { name: "SGST 9%", amount: "36991" },
      ],
      // The model said Materials; the merchant's own expenses say Fuel & freight.
      categoryId: fuel,
      categoryFrom: "merchant",
      merchantExpenses: 3,
      readAsImages: false,
    });
    // The categories were sent to choose from, with what each is for.
    expect(String(lastChat().messages[0]!.content)).toContain("- Fuel & freight — Diesel, petrol and transport");
  });

  it("for a new merchant takes the category the model chose from the list, and leaves tax to the category when the receipt shows none", async () => {
    stub.setReply(JSON.stringify({ merchant: "Bunnings", whatWasBought: "timber screws", date: "2026-10-14", total: 42.5, category: "materials" }));
    expect(await json<ReceiptSuggestion>(await read(await receipt()))).toMatchObject({ description: "Bunnings — timber screws", categoryId: materials, categoryFrom: "category", taxAmount: null, taxRateId: null, merchantExpenses: 0 });

    stub.setReply(JSON.stringify({ merchant: "Corner Café", total: 12, category: "Snacks" }));
    expect(await json<ReceiptSuggestion>(await read(await receipt()))).toMatchObject({ categoryId: null, categoryFrom: null, description: "Corner Café" });
  });

  it("Field reads the receipt on their own expense without the Team right; Staff need it; nobody reads another's upload", async () => {
    stub.setReply(JSON.stringify({ merchant: "HP Fuel Centre", total: 100 }));
    const his = await upload(billPhoto(), "image/png", "his.png", fieldUser);
    expect((await read(his, fieldUser)).status).toBe(200);
    expect((await read(his)).status).toBe(404);

    // General Staff starts without "Use AI features".
    const hers = await upload(billPhoto(), "image/png", "hers.png", staff);
    expect((await read(hers, staff)).status).toBe(403);
    expect((await read(hers, fieldUser)).status).toBe(404);
  });

  it("reads a rejected expense's receipt for fixing it, recorded against that expense; not an approved one's", async () => {
    stub.setReply(JSON.stringify({ merchant: "HP Fuel Centre", total: 100 }));
    const fileId = await receipt();
    const expense = await json<{ id: string }>(await call("POST", "/expenses", { categoryId: fuel, date: "2026-10-12", currency: "INR", amount: "10000", receiptFileId: fileId }));
    await json(await call("POST", `/expenses/${expense.id}/reject`, { comment: "Wrong day" }));
    await json(await read(fileId));
    const [row] = await db.select().from(aiRequests).where(eq(aiRequests.orgId, orgId)).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(row).toMatchObject({ entityType: "expense", entityId: expense.id, outcome: "ok" });

    const approvedFile = await receipt();
    const approved = await json<{ id: string }>(await call("POST", "/expenses", { categoryId: fuel, date: "2026-10-11", currency: "INR", amount: "10000", receiptFileId: approvedFile }));
    await json(await call("POST", `/expenses/${approved.id}/approve`, {}));
    expect((await read(approvedFile)).status).toBe(409);
  });
});
