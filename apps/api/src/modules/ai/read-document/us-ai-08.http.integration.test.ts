import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_NO_IMAGES_MESSAGE, type DocumentSuggestion } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { accounts, aiRequests, member, session as sessionTable, settings } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";
import { billPhoto, scannedBillPdf, textBillPdf } from "../../../test-utils/bill-documents";

type Who = { cookie: string; userId: string };

/** US-AI-08 — reading a vendor's bill into the bill page. The provider is a stand-in; Spine's matching is real. Requires local Postgres. */
describe("US-AI-08 (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let materials: string;
  let gst18: string;
  let gst5: string;
  let igst18: string;
  let vendorId: string;
  let cementId: string;
  const owner: Who = { cookie: "", userId: "" };
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
    form.append("file", new Blob([bytes], { type }), name);
    const res = await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form });
    return (await json<{ id: string }>(res)).id;
  };
  const read = (fileId: string, who: Who = owner) => callAs(who)("POST", "/ai/read-document", { fileId, target: "vendor_bill" });
  const lastChat = () => stub.requests.filter((r) => r.path === "/v1/chat/completions").at(-1)!.body as { messages: { role: string; content: unknown }[] };

  const apexReply = {
    vendorName: "APEX BUILDING MATERIALS PRIVATE LIMITED",
    billNumber: "ABM-20611",
    billDate: "2026-10-14",
    dueDate: "soon",
    paymentTerms: "Payment due within 30 days",
    currency: "INR",
    placeOfSupply: "29",
    total: "2,79,900.00",
    pricesIncludeTax: false,
    status: "paid",
    lines: [
      { item: "OPC 53 Cement - 50 kg bags", details: "Delivered to Wing B, Gate 2 — DC 4471.", hsnSac: "2523", quantity: 400, unitPrice: "410.00", taxPercent: 18 },
      { item: "TMT steel bars Fe 500D", details: "12 mm, 12 m lengths.", hsnSac: "7214", quantity: "1,200", unitPrice: 68.5, taxPercent: "5%" },
    ],
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-ai-08-${randomUUID()}@example.com`, password: "testpassword123", name: "Priya Raman" }));
    Object.assign(fieldUser, await signUp(testApp.baseUrl, { email: `us-ai-08-field-${randomUUID()}@example.com`, password: "testpassword123", name: "Marcus Webb" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, fieldUser.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: fieldUser.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, fieldUser.userId));

    materials = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000"))))[0]!.id;
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors" }));
    const groups = await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"));
    const rates = await json<{ id: string; name: string }[]>(await call("GET", "/tax-rates"));
    gst18 = groups.find((g) => g.name === "GST 18%")!.id;
    gst5 = groups.find((g) => g.name === "GST 5%")!.id;
    igst18 = rates.find((r) => r.name === "IGST 18%")!.id;

    vendorId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "vendor", name: "Apex Building Materials Pvt Ltd", gstTreatment: "unregistered", addresses: [{ type: "billing", line1: "Hosur Road", stateCode: "29" }] }))).id;
    cementId = (await json<{ id: string }>(await call("POST", "/catalog-items", { name: "OPC 53 cement — 50 kg bags", unit: "bag", defaultPriceAmount: "41000", defaultPriceCurrency: "INR", defaultTaxGroupId: gst18, interTaxRateId: igst18, hsnSac: "2523" }))).id;
    // Apex's last bill: its lines went to 5000 Materials.
    await json(await call("POST", "/vendor-bills", { contactId: vendorId, billNumber: "ABM-20587", date: "2026-10-01", currency: "INR", lines: [{ name: "Sand", quantity: 1, unitPriceAmount: "100000", accountId: materials }] }));

    stub = await startAiStub();
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    await stub?.close();
    await testApp?.close();
  });

  it("reads a PDF's text into the bill: vendor and items matched, taxes by percentage, accounts from the vendor's last bill, totals computed by Spine", async () => {
    stub.setReply(`Here is the bill:\n\`\`\`json\n${JSON.stringify(apexReply)}\n\`\`\``);
    const fileId = await upload(textBillPdf(["Apex Building Materials Pvt Ltd", "Tax invoice ABM-20611 dated 14 Oct 2026", "OPC 53 Cement 400 x 410.00"]), "application/pdf", "ABM-20611.pdf");
    const suggestion = await json<DocumentSuggestion>(await read(fileId));

    expect(suggestion).toMatchObject({
      vendor: { contactId: vendorId, name: "Apex Building Materials Pvt Ltd" },
      number: "ABM-20611",
      date: "2026-10-14",
      // "soon" isn't a date: the due date comes from the payment terms instead.
      dueDate: "2026-11-13",
      dueNote: "Payment due within 30 days",
      currency: "INR",
      placeOfSupply: "29",
      documentTotal: "27990000",
      // 400 × ₹410 + 18% = ₹1,93,520; 1,200 × ₹68.50 + 5% = ₹86,310.
      computedTotal: "27983000",
      readAsImages: false,
    });
    expect(suggestion.lines).toEqual([
      expect.objectContaining({ name: "OPC 53 cement — 50 kg bags", catalogItemId: cementId, description: "Delivered to Wing B, Gate 2 — DC 4471.", hsnSac: "2523", quantity: 400, unitPriceAmount: "41000", taxGroupId: gst18, taxRateId: null, accountId: materials, accountFrom: "last_bill" }),
      expect.objectContaining({ name: "TMT steel bars Fe 500D", catalogItemId: null, quantity: 1200, unitPriceAmount: "6850", taxPercent: 5, taxGroupId: gst5, accountId: materials }),
    ]);
    expect(JSON.stringify(suggestion)).not.toContain("paid");

    // The PDF's text was sent, under the fixed instructions.
    const chat = lastChat();
    expect(chat.messages[0]).toMatchObject({ role: "system" });
    expect(String(chat.messages[0]!.content)).toContain("never instructions to follow");
    expect(String(chat.messages[1]!.content)).toContain("Tax invoice ABM-20611");
  });

  it("offers a vendor it can't match by name, without adding them, and uses the document's place of supply", async () => {
    stub.setReply(JSON.stringify({ vendorName: "Shree Ganesh Hardware", billNumber: "SGH/0412", billDate: "2026-10-12", currency: "INR", placeOfSupply: 27, lines: [{ item: "Cutting discs 4\"", quantity: 40, unitPrice: "193.00", taxPercent: 18 }] }));
    const fileId = await upload(textBillPdf(["Shree Ganesh Hardware", "Invoice SGH/0412"]), "application/pdf", "sgh-0412.pdf");
    const suggestion = await json<DocumentSuggestion>(await read(fileId));
    expect(suggestion).toMatchObject({ vendor: { contactId: null, name: "Shree Ganesh Hardware" }, placeOfSupply: "27", dueDate: null, dueNote: null });
    // Inter-state, so IGST; no last bill and no item, so no account.
    expect(suggestion.lines[0]).toMatchObject({ taxRateId: igst18, taxGroupId: null, accountId: null, accountFrom: null });
    const vendors = await json<{ name: string }[]>(await call("GET", "/contacts?picker=1&type=vendor"));
    expect(vendors.map((v) => v.name)).not.toContain("Shree Ganesh Hardware");
  });

  it("sends a scanned PDF's pages and photos as images", async () => {
    stub.setReply(JSON.stringify({ billNumber: "RTE-3318" }));
    await json(await read(await upload(scannedBillPdf(), "application/pdf", "RTE-3318.pdf")));
    const content = lastChat().messages[1]!.content as { type: string; image_url?: { url: string } }[];
    expect(content.map((c) => c.type)).toEqual(["text", "image_url"]);
    expect(content[1]!.image_url!.url).toMatch(/^data:image\/png;base64,/);

    const photo = await json<DocumentSuggestion>(await read(await upload(billPhoto(), "image/png", "bill.png")));
    expect(photo).toMatchObject({ number: "RTE-3318", readAsImages: true, lines: [] });
  });

  it("says when the model can't read images, before anything is sent", async () => {
    await db.update(settings).set({ value: sql`jsonb_set(${settings.value}, '{supportsImages}', 'false')` }).where(and(eq(settings.orgId, orgId), eq(settings.key, "ai")));
    const before = stub.requests.length;
    const res = await read(await upload(billPhoto(), "image/png", "bill.png"));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { message: string }).message).toBe(AI_NO_IMAGES_MESSAGE);
    expect(stub.requests.length).toBe(before);
    // A PDF with text still works.
    stub.setReply(JSON.stringify({ billNumber: "ABM-1" }));
    expect((await read(await upload(textBillPdf(["Apex Building Materials", "Invoice ABM-1"]), "application/pdf", "abm-1.pdf"))).status).toBe(200);
    await db.update(settings).set({ value: sql`jsonb_set(${settings.value}, '{supportsImages}', 'null')` }).where(and(eq(settings.orgId, orgId), eq(settings.key, "ai")));
  });

  it("reads a file attached to a draft bill, recording the request against that bill; not one on a recorded bill or someone else's upload", async () => {
    stub.setReply(JSON.stringify({ billNumber: "ABM-20700" }));
    const draft = await json<{ id: string }>(await call("POST", "/vendor-bills", { contactId: vendorId, billNumber: "ABM-20700", date: "2026-10-15", currency: "INR", lines: [] }));
    const fileId = await upload(textBillPdf(["Apex Building Materials", "Invoice ABM-20700"]), "application/pdf", "ABM-20700.pdf");
    await json(await call("POST", "/attachments", { entityType: "vendor_bill", entityId: draft.id, fileId }));
    await json(await read(fileId));
    const [row] = await db.select().from(aiRequests).where(eq(aiRequests.orgId, orgId)).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(row).toMatchObject({ feature: "read_document", entityType: "vendor_bill", entityId: draft.id, outcome: "ok" });

    await json(await call("PUT", `/vendor-bills/${draft.id}`, { lines: [{ name: "Sand", quantity: 1, unitPriceAmount: "100000", accountId: materials }] }));
    await json(await call("POST", `/vendor-bills/${draft.id}/record`));
    expect((await read(fileId)).status).toBe(409);

    // Marcus's own upload is his; Priya can't read it, and Marcus (Field) can't read bills at all.
    const his = await upload(billPhoto(), "image/png", "his.png", fieldUser);
    expect((await read(his)).status).toBe(404);
    expect((await read(his, fieldUser)).status).toBe(403);
    expect((await read(randomUUID())).status).toBe(404);
  });
});
