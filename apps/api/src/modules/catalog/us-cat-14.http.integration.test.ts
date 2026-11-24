import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CatalogBundle } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-CAT-14 (D-213) — a bundle made from catalogue items, at each item's
 * default price and tax. Requires local Postgres.
 */
describe("US-CAT-14 · make a bundle from items (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-cat-14-${randomUUID()}@example.com`;
  let cookie: string;

  const call = (method: string, route: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const addItem = async (name: string, price: string, currency = "USD", taxRateId?: string) =>
    json<{ id: string }>(await call("POST", "/catalog-items", { name, unit: "each", defaultPriceAmount: price, defaultPriceCurrency: currency, defaultTaxRateId: taxRateId }));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    cookie = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).cookie;
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("saves the items with their quantities, default prices and tax, and lists it", async () => {
    const rate = await json<{ id: string }>(await call("POST", "/tax-rates", { name: `Sales tax ${randomUUID().slice(0, 6)}`, rate: 10 }));
    const cement = await addItem("Cement", "41000", "USD", rate.id);
    const tiling = await addItem("Tiling", "95000");
    const res = await call("POST", "/catalog-bundles", {
      name: "Bathroom refit",
      description: "Materials and finish",
      items: [
        { catalogItemId: cement.id, quantity: 2 },
        { catalogItemId: tiling.id, quantity: 1.5 },
      ],
    });
    expect(res.status).toBeLessThan(300);
    const bundle = await json<CatalogBundle>(res);
    expect(bundle).toMatchObject({ name: "Bathroom refit", description: "Materials and finish", currency: "USD" });
    expect(bundle.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPriceAmount: l.unitPriceAmount, taxRatePercentage: l.taxRatePercentage, catalogItemId: l.catalogItemId }))).toEqual([
      { name: "Cement", quantity: 2, unitPriceAmount: "41000", taxRatePercentage: 10, catalogItemId: cement.id },
      { name: "Tiling", quantity: 1.5, unitPriceAmount: "95000", taxRatePercentage: 0, catalogItemId: tiling.id },
    ]);
    // 2 × 410.00 + 10% tax = 902.00; 1.5 × 950.00 = 1,425.00.
    expect(bundle.totalAmount).toBe(String(90200 + 142500));
    const listed = await json<CatalogBundle[]>(await call("GET", "/catalog-bundles"));
    expect(listed.map((b) => b.id)).toContain(bundle.id);
  });

  it("refuses items in more than one currency, archived items, and neither or both sources", async () => {
    const usd = await addItem("Labour", "5000");
    const eur = await addItem("Imported fixture", "5000", "EUR");
    const mixed = await call("POST", "/catalog-bundles", { name: "Mixed", items: [{ catalogItemId: usd.id, quantity: 1 }, { catalogItemId: eur.id, quantity: 1 }] });
    expect(mixed.status).toBe(400);
    expect(((await mixed.json()) as { message: string }).message).toBe("Choose items in one currency.");

    await call("POST", `/catalog-items/${usd.id}/archive`);
    expect((await call("POST", "/catalog-bundles", { name: "Archived", items: [{ catalogItemId: usd.id, quantity: 1 }] })).status).toBe(400);
    expect((await call("POST", "/catalog-bundles", { name: "Nothing" })).status).toBe(400);
    expect((await call("POST", "/catalog-bundles", { name: "Both", sourceQuoteId: randomUUID(), items: [{ catalogItemId: eur.id, quantity: 1 }] })).status).toBe(400);
  });
});
