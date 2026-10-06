import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, TopExpenses } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";

type Who = { cookie: string; userId: string };

/** US-DASH-22 — the five largest expense accounts for a period, with "Other"; gated by reports.view_financial_statements. Requires local Postgres. */
describe("US-DASH-22 · see where money goes (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [plain, "plain"]] as const) {
      const email = `us-dash-22-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, ["reports.view_financial_statements"]);
    await join(plain, ["reports.view_receivables"]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("with no expenses the rows are empty", async () => {
    const top = await json<TopExpenses>(await call(owner, "GET", "/dashboard/top-expenses?period=month"));
    expect([top.rows, top.other, top.total]).toEqual([[], null, "0"]);
  });

  it("shows the five largest expense accounts with amount and %, and Other", async () => {
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const today = orgClock().date;
    for (const [accountCode, amount] of [["5000", "1238000"], ["5200", "987500"], ["6000", "720000"], ["6500", "105000"], ["6300", "81240"], ["6900", "22800"], ["6100", "10000"]] as const) {
      await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code[accountCode], amount, date: today }));
    }
    const top = await json<TopExpenses>(await call(owner, "GET", "/dashboard/top-expenses?period=month"));
    expect(top.from).toBe(`${today.slice(0, 8)}01`);
    expect(top.rows.map((r) => [r.code, r.amount, r.percent])).toEqual([
      ["5000", "1238000", "39.1"],
      ["5200", "987500", "31.2"],
      ["6000", "720000", "22.8"],
      ["6500", "105000", "3.3"],
      ["6300", "81240", "2.6"],
    ]);
    expect(top.other).toEqual({ amount: "32800", percent: "1.0" });
    expect(top.total).toBe("3164540");
  });

  it("quarter and financial year start where they should; anything else is refused", async () => {
    const today = orgClock().date;
    const m = Number(today.slice(5, 7));
    expect((await json<TopExpenses>(await call(owner, "GET", "/dashboard/top-expenses?period=quarter"))).from).toBe(`${today.slice(0, 4)}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`);
    await json(await call(owner, "PUT", "/org/settings/financial_year_start", { value: { month: 1, day: 1 } }));
    expect((await json<TopExpenses>(await call(owner, "GET", "/dashboard/top-expenses?period=year"))).from).toBe(`${today.slice(0, 4)}-01-01`);
    expect((await call(owner, "GET", "/dashboard/top-expenses?period=week")).status).toBe(400);
  });

  it("needs 'View financial statements'", async () => {
    expect((await call(accountant, "GET", "/dashboard/top-expenses?period=month")).status).toBe(200);
    expect((await call(plain, "GET", "/dashboard/top-expenses?period=month")).status).toBe(403);
  });
});
