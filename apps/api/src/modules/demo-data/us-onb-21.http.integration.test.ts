import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, settings } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ReportsService } from "../reports/reports.service";

/**
 * US-ONB-21 (D-192) — a demo in the UK, Australia, New Zealand, the UAE or
 * Saudi Arabia is in local money with the country's preset rates; the Tax
 * Summary shows the standard rate and a zero-rated, exempt or outside-the-
 * scope line; a UK invoice is titled "VAT invoice". Requires local Postgres.
 */
describe("US-ONB-21 · explore a VAT or GST business in my country (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  const load = async (country: string, industry: string) => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-21-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: o.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify({ country, industry }) });
    expect(res.status).toBe(201);
    return m!.organizationId;
  };
  const setting = async (orgId: string, key: string) => (await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, key))))[0]?.value as Record<string, unknown> | undefined;
  const today = orgClock().date;
  const from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - 200)).toISOString().slice(0, 10);

  it.each([
    ["GB", "GBP", "VAT 20%"],
    ["AU", "AUD", "GST 10%"],
    ["NZ", "NZD", "GST 15%"],
    ["AE", "AED", "VAT 5%"],
    ["SA", "SAR", "VAT 15%"],
  ])("%s: %s, the preset's %s and an untaxed export line on the Tax Summary", async (country, currency, standard) => {
    const orgId = await load(country, "it_services");
    expect(await setting(orgId, "currency")).toMatchObject({ code: currency });
    expect((await setting(orgId, "tax_profile"))?.country).toBe(country);
    const summary = await testApp.app.get(ReportsService).taxSummary(orgId, from, today);
    expect(summary.collectedByRate.map((r) => r.name)).toContain(standard);
    expect(BigInt(summary.taxPaid)).toBeGreaterThan(0n);
    const untaxedSales = summary.bySupplyClass.reduce((sum, r) => sum + BigInt(r.sales), 0n);
    expect(untaxedSales).toBeGreaterThan(0n);
  }, 120_000);

  it("UK: invoices are titled \"VAT invoice\", new-home works are zero-rated and mobility aids are at 5%", async () => {
    const construction = await load("GB", "construction");
    expect(((await setting(construction, "document_layout"))?.invoice as { title?: string } | undefined)?.title).toBe("VAT invoice");
    const built = await testApp.app.get(ReportsService).taxSummary(construction, from, today);
    expect(BigInt(built.bySupplyClass.find((r) => r.supplyClass === "zero_rated")!.sales)).toBeGreaterThan(0n);

    const trades = await load("GB", "trades");
    const fitted = await testApp.app.get(ReportsService).taxSummary(trades, from, today);
    expect(fitted.collectedByRate.map((r) => r.name)).toEqual(expect.arrayContaining(["VAT 20%", "VAT 5%"]));
  }, 120_000);
});
