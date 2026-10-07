import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountRegister, MoneyAccount, TaxPayment } from "@spine/shared";
import type { TaxSummaryReport } from "../reports/reports.service";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, journalLines, member, session as sessionTable, taxPayments, taxRates, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { LedgerService } from "../ledger/ledger.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-TAX-08 — paying tax posts P26 using input tax up to what 1200 holds;
 * a refund posts P27; deleting reverses. Owner-only. Requires local Postgres.
 */
describe("US-TAX-08 · record paying tax and using input tax credit (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  let gstId: string;
  let paymentId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const available = async (date = "2026-10-20") => (await json<{ amount: string }>(await call(owner, "GET", `/tax-payments/input-tax-available?date=${date}`))).amount;
  const linesOf = async (entryId: string) =>
    (await db.select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(eq(journalLines.entryId, entryId)))
      .map((l) => [l.code, l.debit, l.credit])
      .sort();
  const summary = async () => json<TaxSummaryReport>(await call(owner, "GET", "/org/tax/summary?from=2026-07-01&to=2026-09-30"));
  const moneyOut = async (amount: string, date: string) => json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount, taxRateId: gstId, date }));

  async function join(who: Who, role: "staff" | "field") {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of ["banking.view", "banking.record", "reports.view"]) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [field, "field"]] as const) {
      const email = `us-tax-08-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(staff, "staff");
    await join(field, "field");
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [gst] = await db.insert(taxRates).values({ orgId, name: "GST 18%", rate: 18 }).returning();
    gstId = gst!.id;

    // Q3: $18.00 of output tax on a sale, and $9.00 of input tax on a purchase.
    const ledger = testApp.app.get(LedgerService);
    await db.transaction((tx) =>
      ledger.postEntry(tx, {
        orgId,
        date: "2026-08-10",
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
    await moneyOut("5900", "2026-08-15");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("refuses using more input tax than there is", async () => {
    expect(await available()).toBe("900");
    expect(await available("2026-08-14")).toBe("0");
    const res = await call(owner, "POST", "/tax-payments", { periodFrom: "2026-07-01", periodTo: "2026-09-30", inputTaxUsed: "901", amount: "899", moneyAccountId: bank.id, date: "2026-10-20" });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("You have $9.00 of input tax to use. Lower the amount.");
  });

  it("a payment posts P26 and leaves the Tax Summary's figures alone", async () => {
    const before = await summary();
    expect([before.taxCollected, before.taxPaid, before.netTaxPayable]).toEqual(["1800", "900", "900"]);
    const payment = await json<TaxPayment>(
      await call(owner, "POST", "/tax-payments", { periodFrom: "2026-07-01", periodTo: "2026-09-30", inputTaxUsed: "900", amount: "900", moneyAccountId: bank.id, date: "2026-10-20", reference: "Q3 sales tax return" }),
    );
    paymentId = payment.id;
    expect(payment).toMatchObject({ kind: "payment", inputTaxUsed: "900", amount: "900", moneyAccount: { id: bank.id }, reference: "Q3 sales tax return" });
    const [row] = await db.select().from(taxPayments).where(eq(taxPayments.id, payment.id));
    expect(await linesOf(row!.entryId)).toEqual([["1010", 0n, 900n], ["1200", 0n, 900n], ["2100", 1800n, 0n]].sort());
    expect(await summary()).toMatchObject({ taxCollected: "1800", taxPaid: "900" });
    expect(await available()).toBe("0");

    const listed = await json<TaxPayment[]>(await call(owner, "GET", "/tax-payments?from=2026-07-01&to=2026-09-30"));
    expect(listed.map((p) => p.id)).toEqual([payment.id]);
    const register = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(register.rows.find((r) => r.sourceId === payment.id)).toMatchObject({ what: "Tax payment", reference: "Q3 sales tax return" });
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "tax_payment"), eq(auditLog.entityId, payment.id)));
    expect(audit?.action).toBe("created");
  });

  it("a refund posts P27, within the input tax left", async () => {
    await moneyOut("1180", "2026-10-01"); // $1.80 input tax
    const over = await call(owner, "POST", "/tax-refunds", { amount: "181", moneyAccountId: bank.id, date: "2026-10-21" });
    expect(over.status).toBe(400);
    expect(await message(over)).toBe("You have $1.80 of input tax to use. Lower the amount.");
    const refund = await json<TaxPayment>(await call(owner, "POST", "/tax-refunds", { amount: "180", moneyAccountId: bank.id, date: "2026-10-21", reference: "Refund order 22" }));
    expect(refund).toMatchObject({ kind: "refund", amount: "180", periodFrom: null, inputTaxUsed: "0" });
    const [row] = await db.select().from(taxPayments).where(eq(taxPayments.id, refund.id));
    expect(await linesOf(row!.entryId)).toEqual([["1010", 180n, 0n], ["1200", 0n, 180n]].sort());
    expect(await available("2026-10-21")).toBe("0");
  });

  it("deleting a payment posts the reversal and gives the input tax back", async () => {
    const res = await call(owner, "DELETE", `/tax-payments/${paymentId}`);
    expect(res.status).toBe(200);
    const [row] = await db.select().from(taxPayments).where(eq(taxPayments.id, paymentId));
    expect(row!.deletedAt).not.toBeNull();
    expect(await linesOf(row!.reversalEntryId!)).toEqual([["1010", 900n, 0n], ["1200", 900n, 0n], ["2100", 0n, 1800n]].sort());
    expect(await available("2099-01-01")).toBe("900");
    const again = await call(owner, "DELETE", `/tax-payments/${paymentId}`);
    expect(again.status).toBe(400);
    expect(await message(again)).toBe("This tax payment has already been deleted.");
    const register = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(register.rows.filter((r) => r.sourceId === paymentId).map((r) => r.what).sort()).toEqual(["Tax payment", "Tax payment deleted"]);
  });

  it("Staff and Field get 403 on every route", async () => {
    const routes: [string, string, unknown?][] = [
      ["GET", "/tax-payments"],
      ["GET", "/tax-payments/input-tax-available"],
      ["POST", "/tax-payments", { periodFrom: "2026-07-01", periodTo: "2026-09-30", inputTaxUsed: "0", amount: "100", moneyAccountId: bank.id, date: "2026-10-20" }],
      ["DELETE", `/tax-payments/${paymentId}`],
      ["POST", "/tax-refunds", { amount: "100", moneyAccountId: bank.id, date: "2026-10-20" }],
    ];
    for (const who of [staff, field]) for (const [method, path, body] of routes) expect((await call(who, method, path, body)).status, `${method} ${path}`).toBe(403);
  });
});
