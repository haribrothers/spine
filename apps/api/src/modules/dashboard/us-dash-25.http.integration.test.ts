import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, TaxPeriod } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, taxRates, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";
import { LedgerService } from "../ledger/ledger.service";

type Who = { cookie: string; userId: string };

/** US-DASH-25 — tax collected, input tax, net payable and paid for the current month or quarter; gated by reports.view_financial_statements. Requires local Postgres. */
describe("US-DASH-25 · see tax owed this period (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };
  const today = orgClock().date;
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];

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
      const email = `us-dash-25-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, ["reports.view_financial_statements"]);
    await join(plain, ["reports.view_receivables"]);
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [gst] = await db.insert(taxRates).values({ orgId, name: "GST 18%", rate: 18 }).returning();
    // $18.00 of output tax on a sale today, and $9.00 of input tax on a purchase.
    const ledger = testApp.app.get(LedgerService);
    await db.transaction((tx) =>
      ledger.postEntry(tx, {
        orgId,
        date: today,
        narration: "Sale",
        sourceType: "test_sale",
        sourceId: randomUUID(),
        lines: [
          { accountId: code["1100"]!, debit: 11800n, credit: 0n },
          { accountId: code["4000"]!, debit: 0n, credit: 10000n },
          { accountId: code["2100"]!, debit: 0n, credit: 1800n },
        ],
      }),
    );
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount: "5900", taxRateId: gst!.id, date: today }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("monthly by default: collected, input tax and net payable for this month, nothing paid yet", async () => {
    const period = await json<TaxPeriod>(await call(owner, "GET", "/dashboard/tax-period"));
    expect(period).toMatchObject({ returnPeriod: "monthly", from: `${today.slice(0, 8)}01`, collected: "1800", input: "900", net: "900", paid: null });
    expect(period.label).toBe(new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }));
    expect(period.to >= today).toBe(true);
  });

  it("follows Settings › Tax › Return period, and shows what's been paid", async () => {
    await json(await call(owner, "PUT", "/org/settings/tax_profile", { value: { returnPeriod: "quarterly" } }));
    const quarter = await json<TaxPeriod>(await call(owner, "GET", "/dashboard/tax-period"));
    expect(quarter.from).toBe(`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`);
    await json(await call(owner, "POST", "/tax-payments", { periodFrom: quarter.from, periodTo: quarter.to, inputTaxUsed: "900", amount: "900", moneyAccountId: bank.id, date: today }));
    expect((await json<TaxPeriod>(await call(owner, "GET", "/dashboard/tax-period"))).paid).toBe("900");
    expect((await call(owner, "PUT", "/org/settings/tax_profile", { value: { returnPeriod: "weekly" } })).status).toBe(400);
  });

  it("needs 'View financial statements'", async () => {
    expect((await call(accountant, "GET", "/dashboard/tax-period")).status).toBe(200);
    expect((await call(plain, "GET", "/dashboard/tax-period")).status).toBe(403);
  });
});
