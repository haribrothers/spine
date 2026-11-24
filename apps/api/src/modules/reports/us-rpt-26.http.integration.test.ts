import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type CashFlowReport, type MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-RPT-26 — the cash flow statement: indirect method, sections per the glossary, ties to bank and cash. Requires local Postgres. */
describe("US-RPT-26 · see where cash came from and where it went (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  let report: CashFlowReport;
  let invoiceTax = 0n;
  const from = "2025-01-01";
  const to = iso(new Date());
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const ledgerOnly: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const line = (section: string, key: string) => report.sections.find((s) => s.key === section)!.lines.find((l) => l.key === key);

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
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [ledgerOnly, "ledger"], [field, "field"]] as const) {
      const email = `us-rpt-26-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, "staff", ["reports.view_financial_statements"]);
    await join(ledgerOnly, "staff", ["ledger.view"]);
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const card = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "card", name: "Business Visa" }));
    const money = (moneyAccountId: string, direction: "in" | "out", accountCode: string, amount: string, date: string) =>
      call(owner, "POST", "/bank-transactions", { moneyAccountId, direction, accountId: code[accountCode], amount, date }).then(json);

    await money(bank.id, "in", "3000", "2000000", "2024-12-31"); // before the range: cash at start
    await money(bank.id, "in", "4100", "500000", "2025-03-01");
    await money(bank.id, "out", "6000", "100000", "2025-03-02");
    await money(bank.id, "out", "1500", "480000", "2025-03-03");
    await money(bank.id, "out", "3100", "300000", "2025-03-04");
    await money(bank.id, "in", "2500", "1000000", "2025-03-05");
    await money(card.id, "out", "6300", "20000", "2025-03-06");
    await json(await call(owner, "POST", "/manual-journals", { date: "2025-03-31", reason: "Depreciation", lines: [{ accountId: code["6500"], debit: "65000", credit: "0" }, { accountId: code["1510"], debit: "0", credit: "65000" }] }));
    const [c] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: c!.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000" }] }));
    const issued = await service.issue(orgId, draft.id, owner.userId);
    invoiceTax = BigInt(issued.taxAmount);

    report = await json<CashFlowReport>(await call(owner, "GET", `/reports/cash-flow?from=${from}&to=${to}`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("cash at start, operating (net profit adjusted for receivables, tax and cards), investing, financing, net change and cash at end", () => {
    expect(report.cashAtStart).toBe("2000000");
    // 5,000 sales + 1,000 invoiced − 1,000 rent − 650 depreciation − 200 on the card.
    expect(line("operating", "net_profit")?.amount).toBe("415000");
    expect(line("operating", "receivables")).toMatchObject({ label: "Increase in receivables and retention", amount: (-(100000n + invoiceTax)).toString() });
    if (invoiceTax > 0n) expect(line("operating", "tax")).toMatchObject({ label: "Tax collected less paid", amount: invoiceTax.toString() });
    expect(line("operating", "cards")).toMatchObject({ label: "Increase in card balances", amount: "20000" });
    const total = (key: string) => report.sections.find((s) => s.key === key)!.total;
    expect(total("operating")).toBe("335000");
    expect(report.sections.find((s) => s.key === "investing")!.lines.map((l) => [l.label, l.amount])).toEqual([
      ["Fixed Assets", "-480000"],
      ["Accumulated Depreciation", "65000"],
    ]);
    expect(total("investing")).toBe("-415000");
    expect(report.sections.find((s) => s.key === "financing")!.lines.map((l) => [l.label, l.amount])).toEqual([
      ["Loans Payable", "1000000"],
      ["Owner's Drawings", "-300000"],
    ]);
    expect(total("financing")).toBe("700000");
    expect([report.netChange, report.cashAtEnd, report.ties]).toEqual(["620000", "2620000", true]);
  });

  it("cash at end is the total of the bank and cash accounts; the card isn't cash", () => {
    expect(report.cashAccounts.map((a) => a.code).sort()).toEqual(["1000", "1010"]);
    expect(report.cashAccounts.reduce((s, a) => s + BigInt(a.amount), 0n).toString()).toBe(report.cashAtEnd);
  });

  it("a line lists the accounts behind it", () => {
    expect(line("operating", "net_profit")!.accounts.map((a) => [a.code, a.amount])).toEqual([
      ["4100", "600000"],
      ["6000", "-100000"],
      ["6300", "-20000"],
      ["6500", "-65000"],
    ]);
    expect(line("operating", "receivables")!.accounts.map((a) => a.code)).toEqual(["1100"]);
  });

  it("Staff need 'View financial statements'; Field never; bad ranges are refused", async () => {
    expect((await call(accountant, "GET", `/reports/cash-flow?from=${from}&to=${to}`)).status).toBe(200);
    for (const who of [ledgerOnly, field]) expect((await call(who, "GET", `/reports/cash-flow?from=${from}&to=${to}`)).status).toBe(403);
    expect((await call(owner, "GET", `/reports/cash-flow?from=${to}&to=${from}`)).status).toBe(400);
  });
});
