import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CatalogItemUsage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-CAT-15 (D-213) — where a catalogue item is used: distinct quotes and
 * invoices with a line from it, and when it was last quoted. Owner and
 * Staff only. Requires local Postgres.
 */
describe("US-CAT-15 · see where an item is used (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-cat-15-${randomUUID()}@example.com`;
  const fieldEmail = `us-cat-15-field-${randomUUID()}@example.com`;
  let cookie: string;
  let fieldCookie: string;
  let contactId: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const line = (catalogItemId: string, name: string) => ({ type: "item", catalogItemId, name, quantity: 1, unitPriceAmount: "10000" });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Ananya Rao" }))).id;

    const field = await signUp(testApp.baseUrl, { email: fieldEmail, password: "testpassword123", name: "Field" });
    fieldCookie = field.cookie;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, fieldEmail]));
  });

  it("counts distinct quotes and invoices with a line from the item, and when it was last quoted", async () => {
    const item = await json<{ id: string }>(await call("POST", "/catalog-items", { name: "Cement", unit: "bag", defaultPriceAmount: "10000", defaultPriceCurrency: "USD" }));
    expect(await json<CatalogItemUsage>(await call("GET", `/catalog-items/${item.id}/usage`))).toEqual({ quotes: 0, invoices: 0, lastQuotedAt: null });

    // Two quotes (one with the item twice) and one invoice.
    await call("POST", "/quotes", { contactId, currency: "USD", lines: [line(item.id, "Cement"), line(item.id, "Cement, second pour")] });
    const second = await json<{ createdAt: string }>(await call("POST", "/quotes", { contactId, currency: "USD", lines: [line(item.id, "Cement")] }));
    expect((await call("POST", "/invoices", { contactId, currency: "USD", lines: [line(item.id, "Cement")] })).status).toBeLessThan(300);

    const usage = await json<CatalogItemUsage>(await call("GET", `/catalog-items/${item.id}/usage`));
    expect(usage.quotes).toBe(2);
    expect(usage.invoices).toBe(1);
    expect(new Date(usage.lastQuotedAt!).getTime()).toBe(new Date(second.createdAt).getTime());
  });

  it("is for Owner and Staff only, and 404 for an item in another organisation", async () => {
    const item = await json<{ id: string }>(await call("POST", "/catalog-items", { name: "Tiling", unit: "sq m", defaultPriceAmount: "9500", defaultPriceCurrency: "USD" }));
    expect((await call("GET", `/catalog-items/${item.id}/usage`, undefined, fieldCookie)).status).toBe(403);
    expect((await call("GET", `/catalog-items/${randomUUID()}/usage`)).status).toBe(404);
  });
});
