import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TaxProfile } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
type Doc = { id: string; status: string; placeOfSupply: string | null; supplyType: string | null };

const KARNATAKA_GSTIN = "29AAACK0000A1ZK";

/** US-TAX-13 — the place of supply picks intra- or inter-state GST, snapshotted at issue. Requires local Postgres. */
describe("US-TAX-13 · pick intra- or inter-state GST automatically (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const owner: Who = { cookie: "", userId: "" };
  let expenseAccountId: string;
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
  const line = { name: "Survey", quantity: 1, unitPriceAmount: "10000" };
  const invoice = (contactId: string, extra: Record<string, unknown> = {}) => call("POST", "/invoices", { contactId, currency: "INR", lines: [line], ...extra }).then((r) => json<Doc>(r));
  const newContact = async (body: Record<string, unknown>) => (await json<{ id: string }>(await call("POST", "/contacts", { type: "both", name: `C ${randomUUID().slice(0, 6)}`, ...body }))).id;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-13-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    expenseAccountId = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000"))))[0]!.id;
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: KARNATAKA_GSTIN, stateCode: "29", legalName: "Kaveri Interiors" }));
    contact.siteInTamilNadu = await newContact({
      gstTreatment: "unregistered",
      addresses: [
        { type: "billing", line1: "MG Road", stateCode: "29" },
        { type: "site", line1: "Beach Road", stateCode: "33" },
      ],
    });
    contact.billingInKarnataka = await newContact({ gstTreatment: "consumer", addresses: [{ type: "billing", line1: "MG Road", stateCode: "29" }] });
    contact.overseas = await newContact({ gstTreatment: "overseas", taxId: "GB123456789" });
    contact.sez = await newContact({ gstTreatment: "sez", taxId: KARNATAKA_GSTIN });
    contact.vendorInMaharashtra = await newContact({ gstTreatment: "registered", taxId: "27AAPFU0939F1ZV" });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("India starts with GST 18% within the state and IGST 18% across states as the default tax preference", async () => {
    const profile = await json<TaxProfile & { defaultIntraTax: { taxGroupId: string }; defaultInterTax: { taxRateId: string } }>(await call("GET", "/org/tax/profile"));
    const groups = await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"));
    const rates = await json<{ id: string; name: string }[]>(await call("GET", "/tax-rates"));
    gst18 = groups.find((g) => g.name === "GST 18%")!.id;
    igst18 = rates.find((r) => r.name === "IGST 18%")!.id;
    expect(profile.defaultIntraTax).toEqual({ taxRateId: null, taxGroupId: gst18 });
    expect(profile.defaultInterTax).toEqual({ taxRateId: igst18, taxGroupId: null });
  });

  it("a catalogue item keeps an intra-state and an inter-state tax", async () => {
    const item = await json<{ defaultTaxGroupId: string; interTaxRateId: string }>(
      await call("POST", "/catalog-items", { name: "Kitchen", unit: "set", defaultPriceAmount: "18000000", defaultPriceCurrency: "INR", defaultTaxGroupId: gst18, interTaxRateId: igst18 }),
    );
    expect(item).toMatchObject({ defaultTaxGroupId: gst18, interTaxRateId: igst18 });
    expect((await call("POST", "/catalog-items", { name: "Bad", unit: "set", defaultPriceAmount: "1", defaultPriceCurrency: "INR", interTaxRateId: randomUUID() })).status).toBe(400);
  });

  it("the place of supply comes from the site or shipping address, else billing; my state is intra-state, another inter-state", async () => {
    expect(await invoice(contact.siteInTamilNadu!)).toMatchObject({ placeOfSupply: "33", supplyType: "inter" });
    expect(await invoice(contact.billingInKarnataka!)).toMatchObject({ placeOfSupply: "29", supplyType: "intra" });
  });

  it("overseas is an export (place of supply 96) and an SEZ is inter-state", async () => {
    expect(await invoice(contact.overseas!)).toMatchObject({ placeOfSupply: "96", supplyType: "export" });
    expect(await invoice(contact.sez!)).toMatchObject({ placeOfSupply: "29", supplyType: "inter" });
  });

  it("the place of supply can be changed on a draft, and is snapshotted at issue", async () => {
    const draft = await invoice(contact.billingInKarnataka!, { placeOfSupply: "27" });
    expect(draft).toMatchObject({ placeOfSupply: "27", supplyType: "inter" });
    const changed = await json<Doc>(await call("PUT", `/invoices/${draft.id}`, { placeOfSupply: "29" }));
    expect(changed).toMatchObject({ placeOfSupply: "29", supplyType: "intra" });
    await json(await call("POST", `/invoices/${draft.id}/issue`));

    // Moving the customer afterwards doesn't touch the issued invoice.
    await json(await call("PUT", `/contacts/${contact.billingInKarnataka}`, { addresses: [{ type: "billing", line1: "Anna Salai", stateCode: "33" }] }));
    expect(await json<Doc>(await call("GET", `/invoices/${draft.id}`))).toMatchObject({ status: "issued", placeOfSupply: "29", supplyType: "intra" });
    expect(await invoice(contact.billingInKarnataka!)).toMatchObject({ placeOfSupply: "33", supplyType: "inter" });

    // A credit note has its invoice's place of supply.
    const credit = await json<Doc>(await call("POST", "/credit-notes", { invoiceId: draft.id, lines: [line] }));
    expect(credit).toMatchObject({ placeOfSupply: "29", supplyType: "intra" });
    const refused = await call("POST", "/credit-notes", { invoiceId: draft.id, placeOfSupply: "33", lines: [line] });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { message: string }).message).toBe("A credit note has its invoice's place of supply. Change the invoice instead.");
  });

  it("quotes follow the same rule", async () => {
    const quote = await json<Doc>(await call("POST", "/quotes", { contactId: contact.siteInTamilNadu, currency: "INR", lines: [line] }));
    expect(quote).toMatchObject({ placeOfSupply: "33", supplyType: "inter" });
  });

  it("a vendor bill uses the vendor's state: another state is inter-state, mine intra-state", async () => {
    const bill = (contactId: string) =>
      call("POST", "/vendor-bills", { contactId, billNumber: `B-${randomUUID().slice(0, 6)}`, date: "2026-10-01", currency: "INR", lines: [{ ...line, accountId: expenseAccountId }] }).then((r) => json<Doc>(r));
    expect(await bill(contact.vendorInMaharashtra!)).toMatchObject({ placeOfSupply: "27", supplyType: "inter" });
    expect(await bill(contact.sez!)).toMatchObject({ supplyType: "inter" });
    const local = await newContact({ gstTreatment: "registered", taxId: KARNATAKA_GSTIN });
    const recorded = await bill(local);
    expect(recorded).toMatchObject({ placeOfSupply: "29", supplyType: "intra" });
    const credit = await json<Doc>(
      await call("POST", "/vendor-credits", { contactId: contact.vendorInMaharashtra, vendorReference: "VC-1", date: "2026-10-02", currency: "INR", lines: [{ ...line, accountId: expenseAccountId }] }),
    );
    expect(credit).toMatchObject({ placeOfSupply: "27", supplyType: "inter" });
  });

  it("outside India there is no supply type", async () => {
    const other: Who = { cookie: "", userId: "" };
    Object.assign(other, await signUp(testApp.baseUrl, { email: `us-tax-13-gb-${randomUUID()}@example.com`, password: "testpassword123", name: "GB" }));
    const as = callAs(other);
    await json(await as("PUT", "/org/tax/profile", { country: "GB" }));
    const c = await json<{ id: string }>(await as("POST", "/contacts", { type: "customer", name: "London Ltd" }));
    expect(await json<Doc>(await as("POST", "/invoices", { contactId: c.id, currency: "GBP", lines: [line] }))).toMatchObject({ placeOfSupply: null, supplyType: null });
  });

  it("keeps whether the business exports under LUT (D-181)", async () => {
    expect((await json<{ profile: TaxProfile }>(await call("PUT", "/org/tax/profile", { exportUnderLut: true }))).profile.exportUnderLut).toBe(true);
    expect(await invoice(contact.overseas!)).toMatchObject({ placeOfSupply: "96", supplyType: "export" });
    expect((await call("PUT", "/org/tax/profile", { exportUnderLut: "yes" })).status).toBe(400);
  });
});
