import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type Kpi, type MoneyAccount, type MoneyInOutReport } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

/** US-DASH-26 (D-138, D-179) — profit this month and the money chart on accrual or cash, the choice kept on the member. Requires local Postgres. */
describe("US-DASH-26 · switch dashboard profit between accrual and cash (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  const owner: Who = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const profit = async (basis?: string) => (await json<Kpi[]>(await call("GET", `/dashboard/kpis${basis ? `?basis=${basis}` : ""}`))).find((k) => k.key === "profit")!;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-dash-26-owner-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "owner" }));
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    // A 1,000.00 invoice this month, half paid.
    const service = testApp.app.get(InvoicesService);
    const invoice = await service.issue(orgId, (await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: maple!.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000", taxRatePercentage: 0 }] }))).id, owner.userId);
    const half = (BigInt(invoice.totalAmount) / 2n).toString();
    await json(await call("POST", "/payments", { contactId: maple!.id, date: orgClock().date, method: "bank_transfer", currency: "USD", amount: half, moneyAccountId: bank.id, allocations: [{ invoiceId: invoice.id, amount: half }] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("Profit this month on accrual counts the invoice; on cash, what was paid — and says so", async () => {
    const accrual = await profit();
    expect([accrual.basis, accrual.value]).toEqual(["accrual", "100000"]);
    const cash = await profit("cash");
    expect([cash.basis, cash.value]).toEqual(["cash", "50000"]);
    expect(cash.series).toHaveLength(8);
  });

  it("the money chart: cash is money in and out; accrual is income and expenses", async () => {
    const cash = await json<MoneyInOutReport>(await call("GET", "/reports/money-in-out?months=3"));
    expect([cash.basis, cash.totalIn, cash.totalOut]).toEqual(["cash", "50000", "0"]);
    const accrual = await json<MoneyInOutReport>(await call("GET", "/reports/money-in-out?months=3&basis=accrual"));
    expect([accrual.basis, accrual.totalIn, accrual.totalOut, accrual.hasActivity]).toEqual(["accrual", "100000", "0", true]);
    expect(accrual.months.at(-1)).toMatchObject({ month: orgClock().date.slice(0, 7), in: "100000" });
  });

  it("the choice is kept on the member", async () => {
    expect(await json<{ basis: string }>(await call("GET", "/users/me/dashboard-basis"))).toEqual({ basis: "accrual" });
    await json(await call("PUT", "/users/me/dashboard-basis", { basis: "cash" }));
    expect(await json<{ basis: string }>(await call("GET", "/users/me/dashboard-basis"))).toEqual({ basis: "cash" });
    expect((await call("PUT", "/users/me/dashboard-basis", { basis: "weekly" })).status).toBe(400);
  });
});
