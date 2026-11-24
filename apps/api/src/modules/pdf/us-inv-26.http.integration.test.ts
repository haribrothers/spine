import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../../db/client";
import { invoices } from "../../db/schema";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { IssuedPdfService } from "./issued-pdf.service";

type Invoice = { id: string; orgId: string; number: string; upiQrAmount: string | null; amountPaid: string; balanceDue: string };
const hasImage = (pdf: Buffer) => /\/Subtype \/Image/.test(pdf.toString("latin1"));

/** US-INV-26 — a UPI QR code on invoices. Requires local Postgres. */
describe("US-INV-26 · show a UPI QR code on invoices (requires local Postgres)", () => {
  let testApp: TestApp;
  let cookie = "";
  let contactId = "";
  const profile = { name: "Kaveri Interiors", upiId: "kaveriinteriors@okhdfc", upiPayeeName: "Kaveri Interiors Pvt Ltd", paymentInstructions: "Please use the invoice number as the reference." };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const issue = async (lines: unknown[], currency = "INR", beforeIssue?: (id: string) => Promise<unknown>) => {
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency, lines }));
    await beforeIssue?.(draft.id);
    const issued = await json<Invoice>(await call("POST", `/invoices/${draft.id}/issue`));
    // The PDF is stored when it's issued (the queue does it moments later; here, now).
    await testApp.app.get(IssuedPdfService).getOrStore(issued.orgId, "invoice", issued.id);
    return issued;
  };
  const pdf = async (id: string) => Buffer.from(await (await call("GET", `/invoices/${id}/pdf`)).arrayBuffer());
  const kitchen = { name: "Modular kitchen", quantity: 1, unitPriceAmount: "24190000" };

  beforeAll(async () => {
    testApp = await createTestApp();
    cookie = (await signUp(testApp.baseUrl, { email: `us-inv-26-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" })).cookie;
    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/settings/business_profile", { value: profile }));
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Lakeview Homes LLP" }))).id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("an issued invoice's PDF shows the QR code, 'Scan to pay ₹<balance due> with any UPI app' and the UPI ID, beside the payment instructions", async () => {
    const invoice = await issue([kitchen]);
    expect(invoice.upiQrAmount).toBe("24190000");
    const buf = await pdf(invoice.id);
    if (process.env.SPINE_PREVIEW_DIR) writeFileSync(`${process.env.SPINE_PREVIEW_DIR}/upi-qr.pdf`, buf);
    const text = pdfText(buf);
    expect(text).toContain("How to pay");
    expect(text).toContain("Scan to pay ₹2,41,900.00 with any UPI app");
    expect(text).toContain("kaveriinteriors@okhdfc");
    expect(text).toContain(`note ${invoice.number}`);
    expect(text).toContain("Please use the invoice number as the reference.");
    expect(hasImage(buf)).toBe(true);
  });

  it("the QR keeps the amount at issue, and nothing is recorded when it's printed", async () => {
    const invoice = await issue([kitchen]);
    expect(invoice.amountPaid).toBe("0");
    await json(await call("POST", "/payments", { contactId, date: "2026-10-07", method: "upi", currency: "INR", amount: "4190000", allocations: [{ invoiceId: invoice.id, amount: "4190000" }] }));
    const after = await json<Invoice>(await call("GET", `/invoices/${invoice.id}`));
    expect(after.balanceDue).toBe("20000000");
    expect(after.upiQrAmount).toBe("24190000");
    expect(pdfText(await pdf(invoice.id))).toContain("Scan to pay ₹2,41,900.00 with any UPI app");
  });

  it("an invoice with nothing due at issue has no QR code", async () => {
    // Spine refuses to issue a zero total, and deposits aren't offset on the final invoice yet (D-075):
    // stand in for a deposit that already covers it.
    const db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const invoice = await issue([kitchen], "INR", (id) => db.update(invoices).set({ amountPaid: 24190000n }).where(eq(invoices.id, id)));
    expect(invoice.upiQrAmount).toBeNull();
    const buf = await pdf(invoice.id);
    expect(pdfText(buf)).not.toContain("Scan to pay");
    expect(hasImage(buf)).toBe(false);
  });

  it("no QR code with the setting off, or for an invoice in another currency", async () => {
    await json(await call("PUT", "/org/settings/business_profile", { value: { ...profile, showUpiQr: false } }));
    const off = await issue([kitchen]);
    expect(off.upiQrAmount).toBeNull();
    expect(pdfText(await pdf(off.id))).not.toContain("Scan to pay");
    await json(await call("PUT", "/org/settings/business_profile", { value: { ...profile, showUpiQr: true } }));
    const usd = await issue([kitchen], "USD");
    expect(usd.upiQrAmount).toBeNull();
  });

  it("a draft previews the QR code it would get", async () => {
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "INR", lines: [kitchen] }));
    expect(pdfText(await pdf(draft.id))).toContain("Scan to pay ₹2,41,900.00 with any UPI app · kaveriinteriors@okhdfc · note Draft invoice");
  });
});
