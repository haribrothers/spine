import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

type Who = { cookie: string; userId: string };
const KA_GSTIN = "29AAACK0000A1ZK";
const CUSTOMER_GSTIN = "27AAPFU0939F1ZV";

/** US-TAX-15 — GST details on invoice and credit-note PDFs. Requires local Postgres. */
describe("US-TAX-15 · print GST details on invoices and credit notes (requires local Postgres)", () => {
  let testApp: TestApp;
  const owner: Who = { cookie: "", userId: "" };
  let gst18: string;
  let igst18: string;
  const contact: Record<string, string> = {};

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const call = (method: string, path: string, body?: unknown) => callAs(owner)(method, path, body);
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const pdf = async (path: string) => Buffer.from(await (await call("GET", path)).arrayBuffer());
  const invoice = async (contactId: string, lines: unknown[], issue = true) => {
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "INR", lines }));
    if (issue) await json(await call("POST", `/invoices/${draft.id}/issue`));
    return draft.id;
  };
  const kitchen = () => ({ name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18, hsnSac: "9403" });
  const install = () => ({ name: "Installation", quantity: 1, unitPriceAmount: "2500000", taxGroupId: gst18, hsnSac: "995472" });

  beforeAll(async () => {
    testApp = await createTestApp();
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-15-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Kaveri Interiors", address: "14 Residency Road, Bengaluru 560025" } }));
    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: KA_GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    gst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    igst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-rates"))).find((r) => r.name === "IGST 18%")!.id;
    const add = async (key: string, body: Record<string, unknown>) => (contact[key] = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", isCompany: true, ...body }))).id);
    await add("local", { name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: KA_GSTIN, addresses: [{ type: "billing", line1: "8 Indiranagar 2nd Stage", city: "Bengaluru", stateCode: "29", isPrimary: true }] });
    await add("mumbai", { name: "Harbour Café LLP", gstTreatment: "registered", taxId: CUSTOMER_GSTIN, addresses: [{ type: "billing", line1: "Marine Drive", city: "Mumbai", stateCode: "27", isPrimary: true }] });
    await add("overseas", { name: "Oslo Interiors AS", gstTreatment: "overseas", taxId: "NO123", addresses: [{ type: "billing", line1: "Karl Johans gate 1", city: "Oslo", country: "Norway", isPrimary: true }] });
    await add("consumer", { name: "Anita Rao", gstTreatment: "consumer", addresses: [{ type: "billing", line1: "MG Road", stateCode: "29", isPrimary: true }] });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("an intra-state invoice is a Tax Invoice with both GSTINs, place of supply, HSN/SAC and CGST + SGST per line", async () => {
    const id = await invoice(contact.local!, [kitchen(), install()]);
    const buf = await pdf(`/invoices/${id}/pdf`);
    if (process.env.SPINE_PREVIEW_DIR) writeFileSync(`${process.env.SPINE_PREVIEW_DIR}/gst-intra.pdf`, buf);
    const text = pdfText(buf);
    expect(text).toContain("TAX INVOICE");
    expect(text).toContain(`GSTIN ${KA_GSTIN}`);
    expect(text).toContain("Karnataka (29)");
    expect(text).toContain("Intra-state supply");
    for (const heading of ["HSN/SAC", "Taxable value", "CGST 9%", "SGST 9%"]) expect(text).toContain(heading);
    expect(text).toContain("9403");
    expect(text).toContain("995472");
    // ₹1,80,000 × 9% = ₹16,200 each; ₹25,000 × 9% = ₹2,250 each.
    expect(text).toContain("₹16,200.00");
    expect(text).toContain("₹2,250.00");
    expect(text).toContain("₹18,450.00");
    expect(text).not.toContain("IGST");
  });

  it("an inter-state invoice shows IGST, the customer's GSTIN and their state", async () => {
    const id = await invoice(contact.mumbai!, [{ ...kitchen(), taxGroupId: null, taxRateId: igst18 }]);
    const text = pdfText(await pdf(`/invoices/${id}/pdf`));
    expect(text).toContain(`GSTIN ${CUSTOMER_GSTIN}`);
    expect(text).toContain("Maharashtra (27)");
    expect(text).toContain("Inter-state supply");
    expect(text).toContain("IGST 18%");
    expect(text).toContain("₹32,400.00");
    expect(text).not.toContain("CGST");
  });

  it("an export says it's for export, with the overseas address — with IGST, or under LUT without", async () => {
    const withIgst = pdfText(await pdf(`/invoices/${await invoice(contact.overseas!, [{ ...kitchen(), taxGroupId: null, taxRateId: igst18 }])}/pdf`));
    expect(withIgst).toContain("Supply meant for export with payment of IGST");
    expect(withIgst).toContain("Karl Johans gate 1, Oslo, Norway");
    expect(withIgst).toContain("Other countries (96)");
    await json(await call("PUT", "/org/tax/profile", { exportUnderLut: true }));
    const lut = pdfText(await pdf(`/invoices/${await invoice(contact.overseas!, [{ ...kitchen(), taxGroupId: null, supplyClass: "zero_rated" }])}/pdf`));
    expect(lut).toContain("Supply meant for export under LUT without payment of IGST");
    await json(await call("PUT", "/org/tax/profile", { exportUnderLut: false }));
  });

  it("an invoice where every line is exempt or non-taxable is a Bill of Supply", async () => {
    const id = await invoice(contact.consumer!, [
      { name: "Design consultation", quantity: 1, unitPriceAmount: "500000", supplyClass: "exempt", hsnSac: "998391" },
      { name: "Pass-through fee", quantity: 1, unitPriceAmount: "10000", supplyClass: "non_taxable" },
    ]);
    const text = pdfText(await pdf(`/invoices/${id}/pdf`));
    expect(text).toContain("BILL OF SUPPLY");
    expect(text).not.toContain("TAX INVOICE");
  });

  it("follows the lines with an HSN-wise tax summary when the layout option is on", async () => {
    await json(await call("PUT", "/org/settings/document_layout", { value: { invoice: { taxSummary: true } } }));
    const text = pdfText(await pdf(`/invoices/${await invoice(contact.local!, [kitchen(), install()], false)}/pdf`));
    expect(text).toContain("Total tax");
    expect(text).toContain("₹32,400.00");
    expect(text).toContain("₹4,500.00");
    await json(await call("PUT", "/org/settings/document_layout", { value: {} }));
  });

  it("a credit note shows the same GST details and the original invoice's number and date", async () => {
    const invoiceId = await invoice(contact.local!, [kitchen()]);
    const issued = await json<{ number: string }>(await call("GET", `/invoices/${invoiceId}`));
    const credit = await json<{ id: string }>(await call("POST", "/credit-notes", { invoiceId, lines: [{ name: "Two doors returned", quantity: 1, unitPriceAmount: "1000000", taxRatePercentage: 18, hsnSac: "9403" }] }));
    await json(await call("POST", `/credit-notes/${credit.id}/issue`));
    await testApp.app.get(IssuedPdfService).getOrStore((await json<{ orgId: string }>(await call("GET", `/credit-notes/${credit.id}`))).orgId, "credit_note", credit.id);
    const text = pdfText(await pdf(`/credit-notes/${credit.id}/pdf`));
    expect(text).toContain("CREDIT NOTE");
    expect(text).toContain(`GSTIN ${KA_GSTIN}`);
    expect(text).toContain("Karnataka (29)");
    expect(text).toContain(issued.number);
    expect(text).toMatch(/dated \w+ \d+, \d{4}/);
    expect(text).toContain("CGST 9%");
    expect(text).toContain("₹900.00");
  });

  it("without a GST profile, none of this shows and invoices look as before", async () => {
    const other: Who = { cookie: "", userId: "" };
    Object.assign(other, await signUp(testApp.baseUrl, { email: `us-tax-15-us-${randomUUID()}@example.com`, password: "testpassword123", name: "US" }));
    const as = callAs(other);
    const c = await json<{ id: string }>(await as("POST", "/contacts", { type: "customer", name: "Boston Co" }));
    const draft = await json<{ id: string }>(await as("POST", "/invoices", { contactId: c.id, currency: "USD", lines: [{ name: "Survey", quantity: 1, unitPriceAmount: "10000", taxRatePercentage: 10 }] }));
    const text = pdfText(Buffer.from(await (await as("GET", `/invoices/${draft.id}/pdf`)).arrayBuffer()));
    expect(text).toContain("INVOICE");
    for (const absent of ["TAX INVOICE", "GSTIN", "Place of supply", "CGST", "Taxable value"]) expect(text).not.toContain(absent);
    expect(text).toContain("Subtotal");
  });
});
