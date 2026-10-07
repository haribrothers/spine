import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

const STATEMENTS = [
  "/reports/profit-and-loss?from=2026-01-01&to=2026-12-31",
  "/reports/profit-and-loss?from=2026-01-01&to=2026-12-31&format=xlsx",
  "/reports/profit-and-loss/export.csv?from=2026-01-01&to=2026-12-31",
  "/reports/balance-sheet?asOf=2026-09-30",
  "/reports/balance-sheet/export.csv?asOf=2026-09-30",
  "/reports/trial-balance?asOf=2026-09-30",
  "/reports/trial-balance/export.csv?asOf=2026-09-30",
  "/reports/cash-flow?from=2026-01-01&to=2026-12-31",
  "/org/tax/summary?from=2026-01-01&to=2026-12-31",
  "/org/tax/summary/export.csv?from=2026-01-01&to=2026-12-31",
  "/reports/revenue-trend?months=12",
];

/** US-RPT-36 (D-136) — "View financial statements" opens the statements to a Team, read-only; Field never. Requires local Postgres. */
describe("US-RPT-36 · let my accountant's Team see the financial statements (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [staff, "staff"], [field, "field"]] as const) {
      const email = `us-rpt-36-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, "staff", ["reports.view_financial_statements"]);
    await join(staff, "staff", ["reports.view_receivables", "reports.view_job_profitability"]);
    await join(field, "field");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a member with it loads and exports P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary and the revenue trend", async () => {
    for (const path of STATEMENTS) expect((await call(accountant, "GET", path)).status, path).toBe(200);
  });

  it("a member without it, and Field whatever their Teams, get 403", async () => {
    for (const who of [staff, field]) for (const path of STATEMENTS) expect((await call(who, "GET", path)).status, path).toBe(403);
  });

  it("it's read-only: no journals, opening balances, period close, tax payments or Settings", async () => {
    const refused: [string, string, unknown][] = [
      ["POST", "/manual-journals", { date: "2026-09-30", reason: "x", lines: [] }],
      ["PUT", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] }],
      ["POST", "/opening-balances/lock", undefined],
      ["POST", "/org/fiscal-periods", { name: "FY26", startDate: "2026-01-01", endDate: "2026-12-31" }],
      ["POST", "/tax-payments", {}],
      ["PUT", "/org/settings/currency", { value: { code: "USD" } }],
    ];
    for (const [method, path, body] of refused) expect((await call(accountant, method, path, body)).status, `${method} ${path}`).toBe(403);
  });

  it("Owners always pass", async () => {
    for (const path of STATEMENTS) expect((await call(owner, "GET", path)).status, path).toBe(200);
  });
});
