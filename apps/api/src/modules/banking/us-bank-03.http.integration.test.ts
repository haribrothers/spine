import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import {
  contacts,
  expenseCategories,
  expenses,
  journalLines,
  member,
  moneyAccounts,
  payments,
  session as sessionTable,
  teamMemberships,
  teamPrivileges,
  teams,
  user,
  vendorBills,
} from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-03 (D-140) — every payment, vendor payment and expense names the
 * money account it used, posts to that account, and remembers it for the
 * person. Requires local Postgres.
 */
describe("US-BANK-03 · choose the account money went into or came out of (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let operating: MoneyAccount;
  let cash: MoneyAccount;
  let card: MoneyAccount;
  let customerId: string;
  let vendorId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-03-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

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

  /** The money side of a posted entry: which ledger account, debit and credit. */
  async function moneyLine(entryId: string, account: MoneyAccount) {
    const [line] = await db.select().from(journalLines).where(and(eq(journalLines.entryId, entryId), eq(journalLines.accountId, account.accountId)));
    return line ? { debit: line.debit, credit: line.credit } : null;
  }

  const pay = (who: Who, extra: Record<string, unknown> = {}) =>
    call(who, "POST", "/payments", { contactId: customerId, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", ...extra });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("staff"));
    await join(staff, "staff", ["payments.open", "payments.edit_own", "vendor_payments.open", "vendor_payments.edit_own", "expenses.edit_own", "expenses.view_others", "expenses.approve"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");

    const list = await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"));
    bank = list.find((a) => a.code === "1010")!;
    cash = list.find((a) => a.code === "1000")!;
    operating = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "bank", name: "First Coastal — Operating" }));
    card = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "card", name: "Business Visa" }));

    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    customerId = customer!.id;
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel & freight" }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a payment goes into the chosen account, carries it, and is remembered for the person", async () => {
    const created = await json<{ id: string }>(await pay(staff, { moneyAccountId: operating.id }));
    const [row] = await db.select().from(payments).where(eq(payments.id, created.id));
    expect(row!.moneyAccountId).toBe(operating.id);
    expect(await moneyLine(row!.journalEntryId!, operating)).toEqual({ debit: 454250n, credit: 0n });

    const detail = await json<{ moneyAccount: { id: string; name: string } }>(await call(staff, "GET", `/payments/${created.id}`));
    expect(detail.moneyAccount).toEqual({ id: operating.id, name: "First Coastal — Operating" });
    expect(await json(await call(staff, "GET", "/money-accounts/last-used"))).toMatchObject({ payment: operating.id });
  });

  it("without a choice the organisation default is used", async () => {
    const created = await json<{ id: string }>(await pay(owner));
    const [row] = await db.select().from(payments).where(eq(payments.id, created.id));
    expect(row!.moneyAccountId).toBe(bank.id);
    expect(await moneyLine(row!.journalEntryId!, bank)).toEqual({ debit: 454250n, credit: 0n });
  });

  it("an archived account, or another organisation's, is refused", async () => {
    const closed = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "bank", name: "Closed account" }));
    await db.update(moneyAccounts).set({ archivedAt: new Date() }).where(eq(moneyAccounts.id, closed.id));
    const archivedRes = await pay(owner, { moneyAccountId: closed.id });
    expect(archivedRes.status).toBe(400);
    expect(((await archivedRes.json()) as { message: string }).message).toBe("Choose one of your active accounts.");

    const other = await newUser("other-org");
    const [otherAccount] = await db.select().from(moneyAccounts).innerJoin(member, eq(member.organizationId, moneyAccounts.orgId)).where(eq(member.userId, other.userId));
    const foreignRes = await pay(owner, { moneyAccountId: otherAccount!.money_accounts.id });
    expect(foreignRes.status).toBe(400);
  });

  it("a vendor payment comes out of the chosen account", async () => {
    const [bill] = await db
      .insert(vendorBills)
      .values({ orgId, contactId: vendorId, status: "recorded", billNumber: `B-${randomUUID().slice(0, 6)}`, date: new Date(), currency: "USD", totalAmount: 216000n, createdByUserId: owner.userId })
      .returning();
    const created = await json<{ id: string; journalEntryId: string }>(
      await call(staff, "POST", "/vendor-payments", {
        contactId: vendorId,
        date: "2026-10-01",
        method: "bank_transfer",
        currency: "USD",
        amount: "216000",
        moneyAccountId: cash.id,
        allocations: [{ billId: bill!.id, amount: "216000" }],
      }),
    );
    const detail = await json<{ moneyAccountId: string; journalEntryId: string; moneyAccount: { name: string } }>(await call(staff, "GET", `/vendor-payments/${created.id}`));
    expect(detail.moneyAccount.name).toBe("Cash in Hand");
    expect(await moneyLine(detail.journalEntryId, cash)).toEqual({ debit: 0n, credit: 216000n });
    expect(await json(await call(staff, "GET", "/money-accounts/last-used"))).toMatchObject({ vendor_payment: cash.id });
  });

  it("an expense paid by card credits the card's liability account (P15)", async () => {
    const expense = await json<{ id: string }>(
      await call(owner, "POST", "/expenses", { categoryId, date: "2026-09-22", currency: "USD", amount: "6400", moneyAccountId: card.id }),
    );
    expect(await json(await call(owner, "GET", `/expenses/${expense.id}`))).toMatchObject({ moneyAccountId: card.id, moneyAccount: { name: "Business Visa" } });
    await json(await call(staff, "POST", `/expenses/${expense.id}/approve`, {}));
    const [row] = await db.select().from(expenses).where(eq(expenses.id, expense.id));
    expect(await moneyLine(row!.journalEntryId!, card)).toEqual({ debit: 0n, credit: 6400n });
  });

  it("a Field expense uses the default, and the approver can change the account before approving", async () => {
    const expense = await json<{ id: string }>(
      await call(field, "POST", "/expenses", { categoryId, date: "2026-09-25", currency: "USD", amount: "6400", moneyAccountId: card.id }),
    );
    const [submitted] = await db.select().from(expenses).where(eq(expenses.id, expense.id));
    expect(submitted!.moneyAccountId).toBe(bank.id);

    await json(await call(staff, "POST", `/expenses/${expense.id}/approve`, { moneyAccountId: cash.id }));
    const [approved] = await db.select().from(expenses).where(eq(expenses.id, expense.id));
    expect(approved!.moneyAccountId).toBe(cash.id);
    expect(await moneyLine(approved!.journalEntryId!, cash)).toEqual({ debit: 0n, credit: 6400n });
    expect(await moneyLine(approved!.journalEntryId!, bank)).toBeNull();
    expect(await json(await call(staff, "GET", "/money-accounts/last-used"))).toMatchObject({ expense: cash.id });
  });

  it("Field can't list accounts or read last-used", async () => {
    expect((await call(field, "GET", "/money-accounts")).status).toBe(403);
    expect((await call(field, "GET", "/money-accounts/last-used")).status).toBe(403);
  });
});
