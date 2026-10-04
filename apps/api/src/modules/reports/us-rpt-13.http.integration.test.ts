import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface TrialBalance {
  lines: { code: string; debit: string; credit: string }[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

/** US-RPT-13 — the Trial Balance. Demo-seeded org. Requires local Postgres. */
describe("US-RPT-13 · see a Trial Balance (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails = [`us-rpt-13-${randomUUID()}@example.com`, `us-rpt-13-staff-${randomUUID()}@example.com`];
  let cookie: string;
  let staffCookie: string;
  let orgId: string;
  const asOf = new Date().toISOString().slice(0, 10);

  const get = (path: string, who = cookie) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: emails[0]!, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    expect((await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } })).status).toBeLessThan(300);
    const staff = await signUp(testApp.baseUrl, { email: emails[1]!, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists every account with a balance on its debit or credit side, with matching totals", async () => {
    const report = (await (await get(`/reports/trial-balance?asOf=${asOf}`)).json()) as TrialBalance;
    expect(report.lines.length).toBeGreaterThan(3);
    for (const line of report.lines) {
      expect(BigInt(line.debit) === 0n || BigInt(line.credit) === 0n).toBe(true);
      expect(BigInt(line.debit) + BigInt(line.credit)).toBeGreaterThan(0n);
    }
    const sum = (key: "debit" | "credit") => report.lines.reduce((total, l) => total + BigInt(l[key]), 0n);
    expect(sum("debit").toString()).toBe(report.totalDebit);
    expect(sum("credit").toString()).toBe(report.totalCredit);
    expect(report.totalDebit).toBe(report.totalCredit);
    expect(report.balanced).toBe(true);
    // Sorted by account code; Accounts Receivable sits on the debit side.
    expect(report.lines.map((l) => l.code)).toEqual([...report.lines.map((l) => l.code)].sort());
    expect(BigInt(report.lines.find((l) => l.code === "1100")!.debit)).toBeGreaterThan(0n);
  });

  it("lists zero-balance accounts too when asked", async () => {
    const all = (await (await get(`/reports/trial-balance?asOf=${asOf}&includeZero=true`)).json()) as TrialBalance;
    const accountCount = (await db.select().from(accounts).where(eq(accounts.orgId, orgId))).length;
    expect(all.lines.length).toBe(accountCount);
    expect(all.lines.some((l) => l.debit === "0" && l.credit === "0")).toBe(true);
  });

  it("exports the trial balance as CSV", async () => {
    const res = await get(`/reports/trial-balance/export.csv?asOf=${asOf}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split(/\r?\n/)[0]).toBe("Code,Account,Debit,Credit");
    expect(text).toContain("Total");
  });

  it("is Owner-only", async () => {
    expect((await get(`/reports/trial-balance?asOf=${asOf}`, staffCookie)).status).toBe(403);
  });
});
