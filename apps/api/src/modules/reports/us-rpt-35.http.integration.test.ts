import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type MoneyAccount, type ProfitAndLossComparison } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { prorate } from "./cash-basis.service";

type Who = { cookie: string; userId: string };
type Line = { code: string; amount: string };
type CashPl = {
  basis: string;
  income: Line[];
  expenses: Line[];
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
  accrualNetProfit: string;
  openingExcluded: { cutoverDate: string; invoices: string; bills: string } | null;
  comparison?: ProfitAndLossComparison;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-RPT-35 (D-138) — Profit & Loss on a cash basis, derived from payments at report time. Requires local Postgres. */
describe("US-RPT-35 · see profit and loss on a cash basis (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const range = `from=2026-07-01&to=${iso(new Date())}`;
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
    const email = `us-rpt-35-owner-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [timber] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();

    // An opening invoice from the old books, paid after the cutover.
    await json(await call("PUT", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] }));
    const opening = await json<{ id: string }>(await call("POST", "/opening-balances/invoices", { contactId: maple!.id, number: "RB-2291", invoiceDate: "2026-05-28", dueDate: "2026-06-27", amountDue: "875000" }));
    await json(await call("POST", "/payments", { contactId: maple!.id, date: "2026-09-02", method: "bank_transfer", currency: "USD", amount: "875000", moneyAccountId: bank.id, allocations: [{ invoiceId: opening.id, amount: "875000" }] }));

    // A 1,000.00 services invoice, half paid.
    const service = testApp.app.get(InvoicesService);
    const invoice = await service.issue(orgId, (await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: maple!.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000" }] }))).id, owner.userId);
    const half = (BigInt(invoice.totalAmount) / 2n).toString();
    await json(await call("POST", "/payments", { contactId: maple!.id, date: iso(new Date()), method: "bank_transfer", currency: "USD", amount: half, moneyAccountId: bank.id, allocations: [{ invoiceId: invoice.id, amount: half }] }));

    // A 400.00 bill, 100.00 of it paid; rent paid; depreciation posted.
    const bill = await json<{ id: string }>(
      await call("POST", "/vendor-bills", { contactId: timber!.id, billNumber: "88213", date: "2026-08-01", currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "40000", accountId: code["5000"] }] }),
    );
    await json(await call("POST", `/vendor-bills/${bill.id}/record`));
    await json(await call("POST", "/vendor-payments", { contactId: timber!.id, date: "2026-08-15", method: "bank_transfer", currency: "USD", amount: "10000", moneyAccountId: bank.id, allocations: [{ billId: bill.id, amount: "10000" }] }));
    await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6000"], amount: "12000", date: "2026-08-20" }));
    await json(await call("POST", "/manual-journals", { date: "2026-09-30", reason: "Depreciation", lines: [{ accountId: code["6500"], debit: "3000", credit: "0" }, { accountId: code["1510"], debit: "0", credit: "3000" }] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a half-paid 1,000.00 services invoice is 500.00 of Sales — Services; costs count what was paid; journals and money out as posted", async () => {
    const pl = await json<CashPl>(await call("GET", `/reports/profit-and-loss?${range}&basis=cash`));
    expect(pl.basis).toBe("cash");
    expect(pl.income.map((l) => [l.code, l.amount])).toEqual([["4100", "50000"]]);
    expect(pl.expenses.map((l) => [l.code, l.amount])).toEqual([
      ["5000", "10000"],
      ["6000", "12000"],
      ["6500", "3000"],
    ]);
    expect([pl.totalIncome, pl.totalExpenses, pl.netProfit]).toEqual(["50000", "25000", "25000"]);
    expect(pl.accrualNetProfit).toBe("45000");
  });

  it("payments on opening invoices aren't income, and say so", async () => {
    const pl = await json<CashPl>(await call("GET", `/reports/profit-and-loss?${range}&basis=cash`));
    expect(pl.openingExcluded).toEqual({ cutoverDate: "2026-07-01", invoices: "875000", bills: "0" });
  });

  it("accrual stays the default; comparisons and exports carry the basis", async () => {
    const accrual = await json<CashPl>(await call("GET", `/reports/profit-and-loss?${range}`));
    expect([accrual.basis, accrual.netProfit]).toEqual(["accrual", "45000"]);
    const compared = await json<CashPl>(await call("GET", `/reports/profit-and-loss?${range}&basis=cash&compare=previous`));
    expect(compared.comparison!.netProfit[0]).toBe("25000");
    const csv = await (await call("GET", `/reports/profit-and-loss/export.csv?${range}&basis=cash`)).text();
    expect(csv.split("\n")[1]).toContain("Cash basis");
    expect((await call("GET", `/reports/profit-and-loss?${range}&basis=weird`)).status).toBe(400);
  });

  it("prorates half away from zero", () => {
    expect(prorate(100001n, 1n, 2n)).toBe(50001n);
    expect(prorate(-100001n, 1n, 2n)).toBe(-50001n);
    expect(prorate(31805n, 0n, 7n)).toBe(0n);
  });
});
