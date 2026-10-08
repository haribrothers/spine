import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, type TestApp } from "../../test-utils/test-app";
import { bearer, bearerSignIn, ownerWithFieldUser } from "./field-user.test-helper";

/**
 * US-MOB-06 (D-048) — a phone signed in as Field reaches no invoices,
 * payments, receivables, payables or reports, whatever it asks for.
 * Requires local Postgres.
 */
describe("US-MOB-06 · keep financial reports off phones (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const ctx = await ownerWithFieldUser(testApp.baseUrl, db, emails);
    token = (await bearerSignIn(testApp.baseUrl, ctx.fieldEmail, "testpassword123")).token!;
  }, 60_000);

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it.each([
    "/invoices",
    "/payments",
    "/credit-notes",
    "/reports/receivables",
    "/reports/payables",
    "/reports/profit-and-loss",
    "/reports/dashboard-summary",
    "/reports/payments-received",
    "/reports/general-ledger",
  ])("refuses %s to a Field phone session", async (path) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, { headers: bearer(token) });
    expect(res.status).toBe(403);
  });

  it("gives a Field phone session no dashboard KPIs", async () => {
    const res = await fetch(`${testApp.baseUrl}/dashboard/kpis`, { headers: bearer(token) });
    if (res.status === 200) expect(await res.json()).toEqual([]);
    else expect(res.status).toBe(403);
  });
});
