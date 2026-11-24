import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_INDUSTRIES, isValidGstin, type DemoIndustry, type TaxProfile } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { invoices, member, settings } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ReportsService } from "../reports/reports.service";

type Table = { count: number; taxableValue: string; tax: string };
interface Gstr1Summary {
  tables: Record<"b2b" | "b2cl" | "b2cs" | "cdnr" | "cdnur" | "exp" | "nil" | "hsn", Table>;
  totalsMatchTaxSummary: boolean;
  problems: unknown[];
}

/**
 * US-ONB-19 (D-192) — India's demo businesses: registered in Karnataka,
 * every GST case on their invoices and bills, and a GSTR-1 for this month
 * and last month with no problems and totals equal to the Tax Summary.
 * Requires local Postgres.
 */
describe("US-ONB-19 · explore an Indian GST business (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  const today = orgClock().date;
  const thisMonth = today.slice(0, 7);
  const lastMonth = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
  const exporting: DemoIndustry[] = ["interior_design", "it_services", "professional_services"];

  it.each(DEMO_INDUSTRIES)("%s: GSTR-1 for this month and last has every table, no problems and the Tax Summary's totals", async (industry) => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-19-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    const orgId = m!.organizationId;
    const res = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie: o.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify({ country: "IN", industry }) });
    expect(res.status).toBe(201);

    const [profileRow] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "tax_profile")));
    const profile = profileRow!.value as TaxProfile;
    expect(profile).toMatchObject({ country: "IN", stateCode: "29", returnPeriod: "monthly", exportUnderLut: true });
    expect(isValidGstin(profile.registrationNumber!)).toBe(true);
    const [currency] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    expect(currency!.value).toEqual({ code: "INR", locale: "en-IN" });
    const [business] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "business_profile")));
    expect(business!.value).toMatchObject({ upiId: "demo.business@example", showUpiQr: true });

    // Intra-state CGST + SGST, inter-state IGST, exports and SEZ under LUT zero-rated.
    const docs = await db.select({ supplyType: invoices.supplyType, placeOfSupply: invoices.placeOfSupply, taxAmount: invoices.taxAmount }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued")));
    expect(docs.some((d) => d.supplyType === "intra" && d.taxAmount > 0n)).toBe(true);
    expect(docs.some((d) => d.supplyType === "inter" && d.placeOfSupply === "27" && d.taxAmount > 0n)).toBe(true);
    if (exporting.includes(industry)) expect(docs.some((d) => d.supplyType === "export" && d.placeOfSupply === "96" && d.taxAmount === 0n)).toBe(true);

    const summaries: Gstr1Summary[] = [];
    const files: { b2b?: { inv: { inv_typ: string }[] }[] }[] = [];
    for (const period of [lastMonth, thisMonth]) {
      const s = (await (await fetch(`${testApp.baseUrl}/exports/gstr1?period=${period}&format=summary`, { headers: { cookie: o.cookie } })).json()) as Gstr1Summary;
      expect(s.problems, `${industry} ${period}`).toEqual([]);
      expect(s.totalsMatchTaxSummary, `${industry} ${period}`).toBe(true);
      summaries.push(s);
      files.push(JSON.parse(await (await fetch(`${testApp.baseUrl}/exports/gstr1?period=${period}&format=json`, { headers: { cookie: o.cookie } })).text()));
    }
    const anyRows = (table: keyof Gstr1Summary["tables"]) => summaries.some((s) => s.tables[table].count > 0);
    for (const table of ["b2b", "b2cl", "b2cs", "cdnr", "hsn"] as const) expect(anyRows(table), `${industry} ${table}`).toBe(true);
    expect(anyRows("exp"), `${industry} exp`).toBe(exporting.includes(industry));
    // The SEZ supply under LUT is in B2B as SEWOP.
    expect(files.flatMap((f) => f.b2b ?? []).flatMap((c) => c.inv.map((i) => i.inv_typ))).toContain("SEWOP");

    // The paid side: input GST on registered vendors' bills; the unregistered vendor's bill has none.
    const from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - 200)).toISOString().slice(0, 10);
    const summary = await testApp.app.get(ReportsService).taxSummary(orgId, from, today);
    expect(BigInt(summary.taxPaid)).toBeGreaterThan(0n);
    const types = Object.fromEntries(summary.byTaxType.rows.map((r) => [r.taxType, r]));
    for (const type of ["cgst", "sgst", "igst"]) {
      expect(BigInt(types[type]!.collected), `${industry} ${type} collected`).toBeGreaterThan(0n);
      expect(BigInt(types[type]!.paid), `${industry} ${type} paid`).toBeGreaterThan(0n);
    }
    const classes = Object.fromEntries(summary.bySupplyClass.map((r) => [r.supplyClass, r]));
    expect(BigInt(classes.zero_rated!.sales)).toBeGreaterThan(0n);
    expect(BigInt(classes.non_taxable!.purchases)).toBeGreaterThan(0n);
  }, 120_000);
});
