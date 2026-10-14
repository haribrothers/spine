import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type MoneyAccount, type PaymentRegisterReport } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

/** US-RPT-30 — payments received and made in a range, with allocations and an account filter. Requires local Postgres. */
describe("US-RPT-30 · see payments received and made in a period (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let cash: MoneyAccount;
  let invoiceNumber: string;
  const range = "from=2026-07-01&to=2026-09-30";
  const owner: Who = { cookie: "", userId: "" };
  const arOnly: Who = { cookie: "", userId: "" };
  const apOnly: Who = { cookie: "", userId: "" };

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
    for (const [who, name] of [[owner, "owner"], [arOnly, "ar"], [apOnly, "ap"]] as const) {
      const email = `us-rpt-30-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(arOnly, ["reports.view_receivables"]);
    await join(apOnly, ["reports.view_payables"]);
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const all = await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"));
    bank = all.find((a) => a.code === "1010")!;
    cash = all.find((a) => a.code === "1000")!;
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [blue] = await db.insert(contacts).values({ orgId, type: "customer", name: "Bluewater Hospitality Group", createdByUserId: owner.userId }).returning();
    const [timber] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();

    const service = testApp.app.get(InvoicesService);
    const invoice = await service.issue(orgId, (await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: maple!.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "875000" }] }))).id, owner.userId);
    invoiceNumber = invoice.number!;
    await json(await call(owner, "POST", "/payments", { contactId: maple!.id, date: "2026-09-02", method: "bank_transfer", currency: "USD", amount: "875000", moneyAccountId: bank.id, allocations: [{ invoiceId: invoice.id, amount: "875000" }] }));
    await json(await call(owner, "POST", "/payments", { contactId: blue!.id, date: "2026-08-14", method: "cheque", currency: "USD", amount: "500000", moneyAccountId: cash.id }));
    await json(await call(owner, "POST", "/payments", { contactId: blue!.id, date: "2026-10-02", method: "cash", currency: "USD", amount: "1000" })); // after the range

    const bill = await json<{ id: string }>(
      await call(owner, "POST", "/vendor-bills", { contactId: timber!.id, billNumber: "88213", date: "2026-09-01", currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "216000", accountId: code["5000"] }] }),
    );
    await json(await call(owner, "POST", `/vendor-bills/${bill.id}/record`));
    await json(await call(owner, "POST", "/vendor-payments", { contactId: timber!.id, date: "2026-09-20", method: "bank_transfer", currency: "USD", amount: "216000", moneyAccountId: bank.id, allocations: [{ billId: bill.id, amount: "216000" }] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("payments received: date, number, customer, method, money account, amount and what it was allocated to, newest first", async () => {
    const report = await json<PaymentRegisterReport>(await call(owner, "GET", `/reports/payments-received?${range}`));
    expect(report.rows.map((r) => [r.date, r.contact.name, r.method, r.moneyAccount?.id, r.amount, r.allocations.map((a) => a.number), r.heldAsCredit])).toEqual([
      ["2026-09-02", "Maple Ridge Developments", "bank_transfer", bank.id, "875000", [invoiceNumber], "0"],
      ["2026-08-14", "Bluewater Hospitality Group", "cheque", cash.id, "500000", [], "500000"],
    ]);
    expect(report.rows[0]!.number).toMatch(/^RCP-/);
    expect(report.totals).toEqual({ count: 2, amount: "1375000", heldAsCredit: "500000", heldCount: 1 });
  });

  it("payments made: the same for vendors and bills", async () => {
    const report = await json<PaymentRegisterReport>(await call(owner, "GET", `/reports/payments-made?${range}`));
    expect(report.rows.map((r) => [r.date, r.contact.name, r.amount, r.allocations.map((a) => [a.number, a.amount])])).toEqual([["2026-09-20", "Coastal Timber Supply", "216000", [["88213", "216000"]]]]);
    expect(report.rows[0]!.href).toBe(`/vendor-payments/${report.rows[0]!.id}`);
  });

  it("the account filter shows only that money account's payments", async () => {
    const report = await json<PaymentRegisterReport>(await call(owner, "GET", `/reports/payments-received?${range}&moneyAccountId=${cash.id}`));
    expect(report.rows.map((r) => r.contact.name)).toEqual(["Bluewater Hospitality Group"]);
    expect((await call(owner, "GET", `/reports/payments-received?${range}&moneyAccountId=nope`)).status).toBe(400);
  });

  it("received needs 'View receivables'; made needs 'View payables'", async () => {
    expect((await call(arOnly, "GET", `/reports/payments-received?${range}`)).status).toBe(200);
    expect((await call(arOnly, "GET", `/reports/payments-made?${range}`)).status).toBe(403);
    expect((await call(apOnly, "GET", `/reports/payments-made?${range}`)).status).toBe(200);
    expect((await call(apOnly, "GET", `/reports/payments-received?${range}`)).status).toBe(403);
  });
});
