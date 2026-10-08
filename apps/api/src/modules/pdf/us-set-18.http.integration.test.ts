import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DocumentLayout } from "@spine/shared";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { invoiceTitle } from "./invoice-pdf.template";

/** US-SET-18 — each document's title, terms and notes. Requires local Postgres. */
describe("US-SET-18 · set each document's title, terms and notes (requires local Postgres)", () => {
  let testApp: TestApp;
  const owner = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const previewText = async (type: string, layout: DocumentLayout) =>
    pdfText(Buffer.from(await (await call("GET", `/org/settings/document_layout/preview?type=${type}&layout=${Buffer.from(JSON.stringify(layout)).toString("base64url")}`)).arrayBuffer()));

  beforeAll(async () => {
    testApp = await createTestApp();
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-set-18-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("prints each document type's title", async () => {
    expect(await previewText("quote", { quote: { title: "Quotation" } })).toContain("QUOTATION");
    expect(await previewText("invoice", { invoice: { title: "Estimate" } })).toContain("ESTIMATE");
    expect(await previewText("receipt", { receipt: { title: "Payment receipt" } })).toContain("PAYMENT RECEIPT");
    // A blank title falls back to the default.
    expect(await previewText("quote", { quote: { title: "" } })).toContain("QUOTE");
  });

  it("a GST invoice or credit note keeps GST's title whatever the setting says", () => {
    expect(invoiceTitle({ supplyType: "intra" }, "Estimate")).toBe("TAX INVOICE");
    expect(invoiceTitle({ supplyType: null }, "Estimate")).toBe("ESTIMATE");
  });

  it("credit notes, receipts and statements print the default terms and notes", async () => {
    for (const type of ["credit_note", "receipt", "statement"] as const) {
      const text = await previewText(type, { [type]: { terms: "Refunds within 7 days.", notes: "Thank you for your business." } });
      expect(text, type).toContain("Refunds within 7 days.");
      expect(text, type).toContain("Thank you for your business.");
    }
  });

  it("saves the defaults, and refuses terms over 2,000 characters", async () => {
    const ok = await call("PUT", "/org/settings/document_layout", { value: { quote: { title: "Quotation", terms: "Valid for 30 days.", notes: "Prices include delivery." } } });
    expect(ok.status).toBeLessThan(300);
    const saved = (await (await call("GET", "/org/settings/document_layout")).json()) as { value: DocumentLayout };
    expect(saved.value.quote).toEqual({ title: "Quotation", terms: "Valid for 30 days.", notes: "Prices include delivery." });
    const tooLong = await call("PUT", "/org/settings/document_layout", { value: { invoice: { terms: "x".repeat(2001) } } });
    expect(tooLong.status).toBe(400);
    expect(((await tooLong.json()) as { message: string }).message).toBe("Keep terms under 2,000 characters.");
  });
});
