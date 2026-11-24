import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, invoiceLines, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Line = { name: string; type: string; supplyClass: string | null; taxRatePercentage: number };
type Doc = { id: string; status: string; lines: Line[] };

const EXEMPT_MESSAGE = "An exempt line has no tax. Change the supply type to Taxable to add tax.";

/** US-TAX-11 — every line carries a supply class, snapshotted on the document. Requires local Postgres. */
describe("US-TAX-11 · mark supplies as zero-rated, exempt or outside tax (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let customerId: string;
  let vendorId: string;
  let expenseAccountId: string;
  let gstId: string;
  const owner = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refused = async (res: Response) => {
    expect(res.status).toBe(400);
    return ((await res.json()) as { message: string }).message;
  };
  const invoice = (lines: unknown[]) => call("POST", "/invoices", { contactId: customerId, currency: "INR", lines });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-11-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Lakeview Homes", createdByUserId: owner.userId }).returning();
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Timber Mart", createdByUserId: owner.userId }).returning();
    customerId = customer!.id;
    vendorId = vendor!.id;
    expenseAccountId = (await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000"))))[0]!.id;
    gstId = (await json<{ id: string }>(await call("POST", "/tax-rates", { name: "GST 18%", rate: 18 }))).id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("a catalogue item has a supply type; a taxed item is taxable and an exempt one can't carry tax", async () => {
    const exempt = await json<{ supplyClass: string }>(
      await call("POST", "/catalog-items", { name: "Design consultation", unit: "hour", defaultPriceAmount: "500000", defaultPriceCurrency: "INR", supplyClass: "exempt" }),
    );
    expect(exempt.supplyClass).toBe("exempt");
    const taxed = await json<{ id: string; supplyClass: string }>(
      await call("POST", "/catalog-items", { name: "Kitchen", unit: "set", defaultPriceAmount: "18000000", defaultPriceCurrency: "INR", defaultTaxRateId: gstId }),
    );
    expect(taxed.supplyClass).toBe("taxable");
    expect(await refused(await call("PUT", `/catalog-items/${taxed.id}`, { supplyClass: "exempt" }))).toBe(EXEMPT_MESSAGE);
    const untaxed = await json<{ supplyClass: string }>(await call("POST", "/catalog-items", { name: "Export crate", unit: "each", defaultPriceAmount: "100", defaultPriceCurrency: "INR" }));
    expect(untaxed.supplyClass).toBe("zero_rated");
  });

  it("an untaxed line takes the type it's given, else zero-rated; a taxed line is taxable; headings have none", async () => {
    const draft = await json<Doc>(
      await invoice([
        { type: "heading", name: "Kitchen" },
        { name: "Cabinets", quantity: 1, unitPriceAmount: "100000", taxRateId: gstId },
        { name: "Consultation", quantity: 1, unitPriceAmount: "50000", supplyClass: "exempt" },
        { name: "Crate", quantity: 1, unitPriceAmount: "1000" },
        { name: "Pass-through fee", quantity: 1, unitPriceAmount: "2000", supplyClass: "non_taxable" },
        { name: "Mislabelled", quantity: 1, unitPriceAmount: "2000", taxRateId: gstId, supplyClass: "zero_rated" },
      ]),
    );
    expect(draft.lines.map((l) => [l.name, l.supplyClass])).toEqual([
      ["Kitchen", null],
      ["Cabinets", "taxable"],
      ["Consultation", "exempt"],
      ["Crate", "zero_rated"],
      ["Pass-through fee", "non_taxable"],
      ["Mislabelled", "taxable"],
    ]);
  });

  it("refuses a rate on an exempt or non-taxable line, on every kind of document", async () => {
    const exemptTaxed = { name: "Consultation", quantity: 1, unitPriceAmount: "50000", taxRateId: gstId, supplyClass: "exempt" };
    expect(await refused(await invoice([exemptTaxed]))).toBe(EXEMPT_MESSAGE);
    expect(await refused(await call("POST", "/quotes", { contactId: customerId, currency: "INR", lines: [exemptTaxed] }))).toBe(EXEMPT_MESSAGE);
    expect(
      await refused(
        await call("POST", "/vendor-bills", {
          contactId: vendorId,
          billNumber: `B-${randomUUID().slice(0, 6)}`,
          date: "2026-10-01",
          currency: "INR",
          lines: [{ ...exemptTaxed, supplyClass: "non_taxable", accountId: expenseAccountId }],
        }),
      ),
    ).toBe("A non-taxable line has no tax. Change the supply type to Taxable to add tax.");
  });

  it("carries the type onto quotes, bills and credit notes", async () => {
    const quote = await json<Doc>(await call("POST", "/quotes", { contactId: customerId, currency: "INR", lines: [{ name: "Consultation", quantity: 1, unitPriceAmount: "50000", supplyClass: "exempt" }] }));
    expect(quote.lines[0]!.supplyClass).toBe("exempt");
    const bundle = await json<{ lines: Line[] }>(await call("POST", "/catalog-bundles", { name: "Consulting pack", sourceQuoteId: quote.id }));
    expect(bundle.lines[0]!.supplyClass).toBe("exempt");
    const bill = await json<Doc>(
      await call("POST", "/vendor-bills", {
        contactId: vendorId,
        billNumber: `B-${randomUUID().slice(0, 6)}`,
        date: "2026-10-01",
        currency: "INR",
        lines: [{ name: "Fresh produce", quantity: 1, unitPriceAmount: "1000", accountId: expenseAccountId, supplyClass: "exempt" }],
      }),
    );
    expect(bill.lines[0]!.supplyClass).toBe("exempt");

    const inv = await json<Doc>(await invoice([{ name: "Consultation", quantity: 1, unitPriceAmount: "50000", supplyClass: "exempt" }]));
    await json(await call("POST", `/invoices/${inv.id}/issue`));
    const credit = await json<Doc>(await call("POST", "/credit-notes", { invoiceId: inv.id, lines: [{ name: "Refund", quantity: 1, unitPriceAmount: "1000", supplyClass: "exempt" }] }));
    expect(credit.lines[0]!.supplyClass).toBe("exempt");
  });

  it("an issued document keeps the type snapshotted at issue", async () => {
    const draft = await json<Doc>(await invoice([{ name: "Consultation", quantity: 1, unitPriceAmount: "50000", supplyClass: "exempt" }]));
    const issued = await json<Doc>(await call("POST", `/invoices/${draft.id}/issue`));
    expect(issued.status).toBe("issued");
    // Editing an issued invoice is refused, so its lines keep the type they were issued with.
    expect((await call("PUT", `/invoices/${draft.id}`, { lines: [{ name: "Consultation", quantity: 1, unitPriceAmount: "50000", supplyClass: "zero_rated" }] })).status).toBe(400);
    const rows = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft.id));
    expect(rows.map((r) => r.supplyClass)).toEqual(["exempt"]);
    expect((await json<Doc>(await call("GET", `/invoices/${draft.id}`))).lines[0]!.supplyClass).toBe("exempt");
  });

  it("a 0% rate gives its lines its supply class when they don't name one (D-182); above 0% it carries none", async () => {
    const exemptRate = await json<{ id: string; supplyClass: string | null }>(await call("POST", "/tax-rates", { name: "Exempt", rate: 0, taxType: "vat", supplyClass: "exempt" }));
    expect(exemptRate.supplyClass).toBe("exempt");
    const taxed = await json<{ supplyClass: string | null }>(await call("POST", "/tax-rates", { name: "VAT 20%", rate: 20, supplyClass: "exempt" }));
    expect(taxed.supplyClass).toBeNull();
    const draft = await json<Doc>(
      await invoice([
        { name: "Insurance", quantity: 1, unitPriceAmount: "1000", taxRateId: exemptRate.id },
        { name: "Export", quantity: 1, unitPriceAmount: "1000", taxRateId: exemptRate.id, supplyClass: "zero_rated" },
      ]),
    );
    expect(draft.lines.map((l) => l.supplyClass)).toEqual(["exempt", "zero_rated"]);
  });
});
