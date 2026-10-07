import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExpensesByCategoryReport, MoneyAccount, PurchasesByVendorReport } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-29 — expenses by category (from the ledger) and purchases by vendor (bills less vendor credits). Requires local Postgres. */
describe("US-RPT-29 · see expenses by category and purchases by vendor (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const bills: string[] = [];
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const ledgerOnly: Who = { cookie: "", userId: "" };
  const range = "from=2026-07-01&to=2026-09-30";

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
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [ledgerOnly, "ledger"]] as const) {
      const email = `us-rpt-29-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, ["reports.view_financial_statements"]);
    await join(ledgerOnly, ["ledger.view"]);
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [timber] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    const [spark] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Spark Electrical", createdByUserId: owner.userId }).returning();

    const bill = async (contactId: string, billNumber: string, date: string, accountCode: string, amount: string, taxRatePercentage = 0) => {
      const created = await json<{ id: string }>(
        await call(owner, "POST", "/vendor-bills", { contactId, billNumber, date, currency: "USD", lines: [{ type: "item", name: "Supplies", quantity: 1, unitPriceAmount: amount, accountId: code[accountCode], taxRatePercentage }] }),
      );
      await json(await call(owner, "POST", `/vendor-bills/${created.id}/record`));
      return created.id;
    };
    bills.push(await bill(timber!.id, "88213", "2026-07-10", "5000", "400000", 10));
    bills.push(await bill(timber!.id, "88290", "2026-08-10", "5000", "100000"));
    bills.push(await bill(spark!.id, "SE-17", "2026-09-01", "5100", "200000"));
    await bill(spark!.id, "SE-18", "2026-10-02", "5100", "99900"); // after the range
    const credit = await json<{ id: string }>(
      await call(owner, "POST", "/vendor-credits", { contactId: timber!.id, vendorReference: "CN-4471", date: "2026-09-15", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "50000", accountId: code["5000"] }] }),
    );
    await json(await call(owner, "POST", `/vendor-credits/${credit.id}/record`));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6000"], amount: "120000", date: "2026-08-01" }));
    await json(await call(owner, "POST", "/manual-journals", { date: "2026-09-30", reason: "Depreciation", lines: [{ accountId: code["6500"], debit: "30000", credit: "0" }, { accountId: code["1510"], debit: "0", credit: "30000" }] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("each expense account: amount and % of total, largest first, from bills, journals and money out, less credits", async () => {
    const report = await json<ExpensesByCategoryReport>(await call(owner, "GET", `/reports/expenses-by-category?${range}`));
    expect(report.rows.map((r) => [r.code, r.amount, r.percentOfTotal])).toEqual([
      ["5000", "450000", "56.3"],
      ["5100", "200000", "25.0"],
      ["6000", "120000", "15.0"],
      ["6500", "30000", "3.8"],
    ]);
    expect(report.total).toBe("800000");
  });

  it("each vendor: bill count, amount before tax, tax and total, net of vendor credits; a row lists its bills", async () => {
    const report = await json<PurchasesByVendorReport>(await call(owner, "GET", `/reports/purchases-by-vendor?${range}`));
    expect(report.rows.map((r) => [r.name, r.billCount, r.amountBeforeTax, r.tax, r.total])).toEqual([
      ["Coastal Timber Supply", 2, "450000", "40000", "490000"],
      ["Spark Electrical", 1, "200000", "0", "200000"],
    ]);
    expect(report.rows[0]!.bills.map((b) => [b.number, b.href])).toEqual([
      ["88213", `/vendor-bills/${bills[0]}`],
      ["88290", `/vendor-bills/${bills[1]}`],
    ]);
    expect(report.totals).toEqual({ vendors: 2, billCount: 3, amountBeforeTax: "650000", tax: "40000", total: "690000" });
  });

  it("Staff need 'View financial statements'", async () => {
    for (const path of ["expenses-by-category", "purchases-by-vendor"]) {
      expect((await call(accountant, "GET", `/reports/${path}?${range}`)).status).toBe(200);
      expect((await call(ledgerOnly, "GET", `/reports/${path}?${range}`)).status).toBe(403);
    }
  });
});
