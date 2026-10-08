import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CatalogImportResult } from "@spine/shared";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Line = { name: string; type: string; hsnSac: string | null };
type Doc = { id: string; lines: Line[] };

/** US-TAX-14 — HSN/SAC codes on items and lines, snapshotted on documents. Requires local Postgres. */
describe("US-TAX-14 · add HSN or SAC codes to items and lines (requires local Postgres)", () => {
  let testApp: TestApp;
  const owner = { cookie: "", userId: "" };
  let customerId: string;
  let itemId: string;

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

  beforeAll(async () => {
    testApp = await createTestApp();
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-tax-14-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    customerId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Lakeview Homes", gstTreatment: "registered", taxId: "29AAACK0000A1ZK" }))).id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("a catalogue item has an HSN/SAC code of 4, 6 or 8 digits", async () => {
    const item = await json<{ id: string; hsnSac: string }>(await call("POST", "/catalog-items", { name: "Modular kitchen", unit: "set", defaultPriceAmount: "100000", defaultPriceCurrency: "INR", hsnSac: "9403" }));
    itemId = item.id;
    expect(item.hsnSac).toBe("9403");
    expect(await refused(await call("POST", "/catalog-items", { name: "Bad", unit: "set", defaultPriceAmount: "1", defaultPriceCurrency: "INR", hsnSac: "94031" }))).toBe("Enter 4, 6 or 8 digits.");
    expect((await json<{ hsnSac: string }>(await call("PUT", `/catalog-items/${itemId}`, { hsnSac: "940310" }))).hsnSac).toBe("940310");
    expect((await json<{ hsnSac: string | null }>(await call("PUT", `/catalog-items/${itemId}`, { hsnSac: "" }))).hsnSac).toBeNull();
    await json(await call("PUT", `/catalog-items/${itemId}`, { hsnSac: "9403" }));
  });

  it("a line keeps the code it was given; headings have none; a bad code is refused", async () => {
    const invoice = await json<Doc>(
      await call("POST", "/invoices", {
        contactId: customerId,
        currency: "INR",
        lines: [
          { type: "heading", name: "Kitchen" },
          { name: "Modular kitchen", catalogItemId: itemId, quantity: 1, unitPriceAmount: "100000", hsnSac: "9403" },
          { name: "Installation", quantity: 1, unitPriceAmount: "20000", hsnSac: "995472" },
          { name: "Design", quantity: 1, unitPriceAmount: "5000" },
        ],
      }),
    );
    expect(invoice.lines.map((l) => [l.name, l.hsnSac])).toEqual([
      ["Kitchen", null],
      ["Modular kitchen", "9403"],
      ["Installation", "995472"],
      ["Design", null],
    ]);
    expect(await refused(await call("POST", "/invoices", { contactId: customerId, currency: "INR", lines: [{ name: "X", quantity: 1, unitPriceAmount: "1", hsnSac: "12" }] }))).toBe("Enter 4, 6 or 8 digits.");

    // An issued invoice keeps its codes when the item changes.
    await json(await call("POST", `/invoices/${invoice.id}/issue`));
    await json(await call("PUT", `/catalog-items/${itemId}`, { hsnSac: "94036000" }));
    expect((await json<Doc>(await call("GET", `/invoices/${invoice.id}`))).lines[1]!.hsnSac).toBe("9403");
  });

  it("carries the code onto quotes, bills and bundles", async () => {
    const quote = await json<Doc>(await call("POST", "/quotes", { contactId: customerId, currency: "INR", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "1000", hsnSac: "9403" }] }));
    expect(quote.lines[0]!.hsnSac).toBe("9403");
    const bundle = await json<{ lines: Line[] }>(await call("POST", "/catalog-bundles", { name: "Kitchen pack", sourceQuoteId: quote.id }));
    expect(bundle.lines[0]!.hsnSac).toBe("9403");
  });

  it("maps an HSN/SAC column on catalogue import", async () => {
    const rows = [
      { row: 1, name: "Wardrobe", price: "50000", hsnSac: "9403 60" },
      { row: 2, name: "Bad code", price: "1", hsnSac: "94" },
    ];
    const result = await json<CatalogImportResult>(await call("POST", "/catalog-items/import", { rows }));
    expect(result.rows.map((r) => [r.name, r.status, r.reason])).toEqual([
      ["Wardrobe", "ok", null],
      ["Bad code", "failed", "HSN/SAC 94: enter 4, 6 or 8 digits."],
    ]);
    const items = await json<{ name: string; hsnSac: string | null }[]>(await call("GET", "/catalog-items"));
    expect(items.find((i) => i.name === "Wardrobe")?.hsnSac).toBe("940360");
  });
});
