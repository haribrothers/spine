import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, ProfitAndLossComparison } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
type Pl = { totalIncome: string; netProfit: string; comparison?: ProfitAndLossComparison };
type Bs = { asOf: string; totalAssets: string; comparison?: { asOf: string; totalAssets: string } };

/** US-RPT-27 — Profit & Loss against the previous period, last year or each month; the Balance Sheet against another date. Requires local Postgres. */
describe("US-RPT-27 · compare profit and loss across periods (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const owner: Who = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-rpt-27-owner-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    for (const [direction, accountCode, amount, date] of [
      ["in", "4100", "200000", "2025-08-01"],
      ["in", "4100", "300000", "2026-04-15"],
      ["in", "4100", "400000", "2026-08-10"],
      ["out", "6000", "100000", "2026-09-05"],
    ] as const) {
      await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction, accountId: code[accountCode], amount, date }));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("Previous period: this range beside the one before it, lined up by account", async () => {
    const pl = await json<Pl>(await call("GET", "/reports/profit-and-loss?from=2026-07-01&to=2026-09-30&compare=previous"));
    const c = pl.comparison!;
    expect(c.columns.map((col) => [col.label, col.from, col.to])).toEqual([
      ["Jul – Sep 2026", "2026-07-01", "2026-09-30"],
      ["Apr – Jun 2026", "2026-04-01", "2026-06-30"],
    ]);
    expect(c.income.map((l) => [l.code, l.amounts])).toEqual([["4100", ["400000", "300000"]]]);
    expect(c.expenses.map((l) => [l.code, l.amounts])).toEqual([["6000", ["100000", "0"]]]);
    expect([c.totalIncome, c.netProfit]).toEqual([
      ["400000", "300000"],
      ["300000", "300000"],
    ]);
  });

  it("Same period last year", async () => {
    const c = (await json<Pl>(await call("GET", "/reports/profit-and-loss?from=2026-07-01&to=2026-09-30&compare=last_year"))).comparison!;
    expect(c.columns[1]).toEqual({ label: "Jul – Sep 2025", from: "2025-07-01", to: "2025-09-30" });
    expect(c.income[0]!.amounts).toEqual(["400000", "200000"]);
  });

  it("Each month over a year: one column per month; the report's own totals are the Total", async () => {
    const pl = await json<Pl>(await call("GET", "/reports/profit-and-loss?from=2026-01-01&to=2026-12-31&compare=monthly"));
    const c = pl.comparison!;
    expect(c.columns.map((col) => col.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026", "Dec 2026"]);
    expect(c.income[0]!.amounts.filter((a) => a !== "0")).toEqual(["300000", "400000"]);
    expect(c.income[0]!.amounts[3]).toBe("300000");
    expect(c.netProfit[8]).toBe("-100000");
    expect(pl.totalIncome).toBe("700000");
  });

  it("without compare there's no comparison; bad values are refused", async () => {
    expect((await json<Pl>(await call("GET", "/reports/profit-and-loss?from=2026-07-01&to=2026-09-30"))).comparison).toBeUndefined();
    expect((await call("GET", "/reports/profit-and-loss?from=2026-07-01&to=2026-09-30&compare=weekly")).status).toBe(400);
    const tooLong = await call("GET", "/reports/profit-and-loss?from=2024-01-01&to=2026-01-31&compare=monthly");
    expect(tooLong.status).toBe(400);
    expect(((await tooLong.json()) as { message: string }).message).toBe('Choose 24 months or fewer for "Each month".');
  });

  it("Balance Sheet: Previous year end shows both dates", async () => {
    const bs = await json<Bs>(await call("GET", "/reports/balance-sheet?asOf=2026-09-30&compareAsOf=2025-12-31"));
    expect([bs.asOf, bs.totalAssets]).toEqual(["2026-09-30", "800000"]);
    expect(bs.comparison).toMatchObject({ asOf: "2025-12-31", totalAssets: "200000" });
  });
});
