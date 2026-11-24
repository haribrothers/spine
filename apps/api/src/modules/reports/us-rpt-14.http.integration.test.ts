import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface TaxSummary {
  taxCollected: string;
  taxPaid: string;
  netTaxPayable: string;
  collectedByRate: { name: string; taxableAmount: string; amount: string }[];
  adjustments: { taxableAmount: string; amount: string } | null;
  totalTaxable: string;
}

/** US-RPT-14 — the tax summary for Reports. Demo-seeded org (it has a credit note). Requires local Postgres. */
describe("US-RPT-14 · see tax collected and paid on Reports (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-rpt-14-${randomUUID()}@example.com`;
  let cookie: string;
  const from = "2000-01-01";
  const to = new Date().toISOString().slice(0, 10);

  const get = (path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Tax Owner" });
    cookie = owner.cookie;
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    expect(m).toBeTruthy();
    expect((await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } })).status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("gives tax collected, paid and net payable, with a per-rate breakdown that totals the ledger", async () => {
    const report = (await (await get(`/org/tax/summary?from=${from}&to=${to}`)).json()) as TaxSummary;
    expect(BigInt(report.taxCollected)).toBeGreaterThan(0n);
    expect(BigInt(report.netTaxPayable)).toBe(BigInt(report.taxCollected) - BigInt(report.taxPaid));
    expect(report.collectedByRate.length).toBeGreaterThan(0);
    for (const row of report.collectedByRate) expect(BigInt(row.taxableAmount)).toBeGreaterThan(0n);

    const rowsTax = report.collectedByRate.reduce((sum, r) => sum + BigInt(r.amount), 0n) + BigInt(report.adjustments?.amount ?? "0");
    expect(rowsTax.toString()).toBe(report.taxCollected);
    const rowsTaxable = report.collectedByRate.reduce((sum, r) => sum + BigInt(r.taxableAmount), 0n) + BigInt(report.adjustments?.taxableAmount ?? "0");
    expect(rowsTaxable.toString()).toBe(report.totalTaxable);
  });

  it("shows an adjustments row for credit notes", async () => {
    const report = (await (await get(`/org/tax/summary?from=${from}&to=${to}`)).json()) as TaxSummary;
    expect(report.adjustments).not.toBeNull();
    expect(BigInt(report.adjustments!.taxableAmount)).toBeLessThan(0n);
  });

  it("exports the summary as CSV", async () => {
    const res = await get(`/org/tax/summary/export.csv?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split(/\r?\n/)[0]).toBe("Collected by rate,Taxable amount,Tax");
    expect(text).toContain("Adjustments from credit notes and voided invoices");
    expect(text).toContain("Net payable");
  });
});
