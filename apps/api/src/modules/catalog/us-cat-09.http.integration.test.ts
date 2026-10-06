import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CatalogImportResult } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, catalogItems, member, session as sessionTable, taxRates, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-CAT-09 (D-161) — import catalogue items from a CSV: match tax and accounts, skip duplicates, report failed rows. Requires local Postgres. */
describe("US-CAT-09 · import catalogue items from a spreadsheet (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let gstId: string;
  let sales: string;
  let materials: string;
  const owner: Who = { cookie: "", userId: "" };
  const reader: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const rows = [
    { row: 2, name: "Kitchen fit-out", description: "Full kitchen", unit: "job", price: "$12,500.00", tax: "GST 10%", incomeAccount: "4100", expenseAccount: "Cost of Materials" },
    { row: 3, name: "Site visit", unit: "hour", price: "95", tax: "", incomeAccount: "Sales — Services" },
    { row: 4, name: "Existing item", price: "10" },
    { row: 5, name: "site visit", price: "90" },
    { row: 6, name: "Tiles", price: "40", tax: "VAT 20%" },
    { row: 7, name: "Grout", price: "8", incomeAccount: "9999" },
    { row: 8, name: "", price: "1" },
    { row: 9, name: "Sealant", price: "twelve" },
  ];

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [reader, "reader"]] as const) {
      const email = `us-cat-09-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    // A Staff member who can't create items.
    await db.delete(member).where(eq(member.userId, reader.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: reader.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, reader.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "catalog.edit_own", granted: false });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    gstId = (await db.insert(taxRates).values({ orgId, name: "GST 10%", rate: 10 }).returning())[0]!.id;
    const chart = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
    sales = chart.find((a) => a.code === "4100")!.id;
    materials = chart.find((a) => a.code === "5000")!.id;
    await db.insert(catalogItems).values({ orgId, name: "Existing item", unit: "each", defaultPriceAmount: 100n, defaultPriceCurrency: "USD", createdByUserId: owner.userId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("the preview flags unknown taxes and accounts, duplicates and bad rows, and creates nothing", async () => {
    const preview = await json<CatalogImportResult>(await call(owner, "POST", "/catalog-items/import", { rows, dryRun: true }));
    expect(preview.imported).toBe(0);
    expect(preview.rows.map((r) => [r.row, r.status, r.reason])).toEqual([
      [2, "ok", null],
      [3, "ok", null],
      [4, "duplicate", "Already in the catalogue"],
      [5, "duplicate", "Already in the catalogue"],
      [6, "failed", "Unknown tax VAT 20%"],
      [7, "failed", "Unknown account 9999"],
      [8, "failed", "Name is missing"],
      [9, "failed", "Price twelve isn't an amount"],
    ]);
    expect(await db.select().from(catalogItems).where(eq(catalogItems.orgId, orgId))).toHaveLength(1);
  });

  it("the import creates the good rows with their price, tax and accounts, and skips the rest", async () => {
    const result = await json<CatalogImportResult>(await call(owner, "POST", "/catalog-items/import", { rows }));
    expect(result.imported).toBe(2);
    expect(result.rows.filter((r) => r.status === "duplicate").map((r) => r.name)).toEqual(["Existing item", "site visit"]);
    expect(result.rows.filter((r) => r.status === "failed")).toHaveLength(4);
    const [fitout] = await db.select().from(catalogItems).where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.name, "Kitchen fit-out")));
    expect(fitout).toMatchObject({ orgId, description: "Full kitchen", unit: "job", defaultPriceAmount: 1250000n, defaultTaxRateId: gstId, incomeAccountId: sales, expenseAccountId: materials });
    const [visit] = await db.select().from(catalogItems).where(and(eq(catalogItems.orgId, orgId), eq(catalogItems.name, "Site visit")));
    expect(visit).toMatchObject({ orgId, unit: "hour", defaultPriceAmount: 9500n, defaultTaxRateId: null, incomeAccountId: sales });

    // Importing the same file again skips them all as duplicates.
    const again = await json<CatalogImportResult>(await call(owner, "POST", "/catalog-items/import", { rows: rows.slice(0, 2) }));
    expect([again.imported, again.rows.map((r) => r.status)]).toEqual([0, ["duplicate", "duplicate"]]);
  });

  it("needs the right to create items", async () => {
    expect((await call(reader, "POST", "/catalog-items/import", { rows, dryRun: true })).status).toBe(403);
    expect((await call(owner, "POST", "/catalog-items/import", { rows: [] })).status).toBe(400);
  });
});
