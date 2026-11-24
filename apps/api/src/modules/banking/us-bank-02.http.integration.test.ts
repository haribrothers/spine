import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPaymentSchema, type AccountRegister, type MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { LedgerService } from "../ledger/ledger.service";
import { PaymentsService } from "../payments/payments.service";
import { ReportsService } from "../reports/reports.service";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-02 — each account's balance and register, read from its ledger
 * account's journal lines. Requires local Postgres.
 */
describe("US-BANK-02 · see every account's balance and what moved through it (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let card: MoneyAccount;
  let empty: MoneyAccount;
  let contactId: string;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const noView: Who = { cookie: "", userId: "" };

  const call = (who: Who, path: string, init: { method?: string; body?: unknown } = {}) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  const register = async (who: Who, id: string, query = "") => (await (await call(who, `/money-accounts/${id}/register${query}`)).json()) as AccountRegister;

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-02-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function staffWith(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  async function payment(date: string, amount: bigint, reference: string) {
    const payments = testApp.app.get(PaymentsService);
    await payments.create(orgId, owner.userId, createPaymentSchema.parse({ contactId, date, method: "bank_transfer", reference, currency: "USD", amount: amount.toString(), moneyAccountId: bank.id }));
  }

  /** An entry no document covers, straight through the ledger. */
  async function post(date: string, lines: { accountId: string; debit: bigint; credit: bigint }[]) {
    const ledger = testApp.app.get(LedgerService);
    await db.transaction((tx) => ledger.postEntry(tx, { orgId, date, sourceType: "test_entry", sourceId: randomUUID(), lines }));
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(viewer, await newUser("viewer"));
    await staffWith(viewer, ["banking.view"]);
    Object.assign(noView, await newUser("noview"));
    await staffWith(noView, ["payments.edit_own"]);

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
    const all = (await (await call(owner, "/money-accounts")).json()) as MoneyAccount[];
    bank = all.find((a) => a.code === "1010")!;
    card = (await (await call(owner, "/money-accounts", { method: "POST", body: { kind: "card", name: "Business Visa" } })).json()) as MoneyAccount;
    empty = (await (await call(owner, "/money-accounts", { method: "POST", body: { kind: "bank", name: "Tax reserve" } })).json()) as MoneyAccount;

    const [charges] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    await payment("2026-08-20", 1_000_000n, "INV-0007");
    await payment("2026-09-26", 1_240_000n, "INV-0009");
    await post("2026-09-30", [
      { accountId: charges!.id, debit: 1_800n, credit: 0n },
      { accountId: bank.accountId, debit: 0n, credit: 1_800n },
    ]);
    await payment("2026-10-02", 454_250n, "INV-0011");
    // Card: spent 64.00, then paid off 30.00 from the bank.
    await post("2026-09-22", [
      { accountId: charges!.id, debit: 6_400n, credit: 0n },
      { accountId: card.accountId, debit: 0n, credit: 6_400n },
    ]);
    await post("2026-09-29", [
      { accountId: card.accountId, debit: 3_000n, credit: 0n },
      { accountId: bank.accountId, debit: 0n, credit: 3_000n },
    ]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("Banking lists each account's balance, reconciliation and unreconciled count", async () => {
    const rows = (await (await call(owner, "/money-accounts")).json()) as MoneyAccount[];
    const bankRow = rows.find((r) => r.id === bank.id)!;
    expect(bankRow).toMatchObject({ balance: String(1_000_000 + 1_240_000 - 1_800 - 3_000 + 454_250), lastReconciledOn: null, unreconciledCount: 5 });
    expect(rows.find((r) => r.id === card.id)).toMatchObject({ balance: "3400", unreconciledCount: 2 });
  });

  it("the register has one row per entry with what, contact, reference, in, out and a running balance", async () => {
    const reg = await register(owner, bank.id);
    expect(reg.openingBalance).toBe("0");
    expect(reg.rows.map((r) => [r.date, r.in, r.out, r.balance, r.reconciled])).toEqual([
      ["2026-08-20", "1000000", "0", "1000000", false],
      ["2026-09-26", "1240000", "0", "2240000", false],
      ["2026-09-29", "0", "3000", "2237000", false],
      ["2026-09-30", "0", "1800", "2235200", false],
      ["2026-10-02", "454250", "0", "2689450", false],
    ]);
    const first = reg.rows[0]!;
    expect(first.what).toMatch(/^Payment RCP-\d+$/);
    expect(first).toMatchObject({ sourceType: "payment", contact: { id: contactId, name: "Maple Ridge Developments" }, reference: "INV-0007" });
    expect(reg.rows[2]!.what).toBe("Journal entry");
    expect(reg.closingBalance).toBe("2689450");
    expect(reg.hasEntries).toBe(true);
  });

  it("a date range starts from the true balance before it", async () => {
    const reg = await register(owner, bank.id, "?from=2026-09-01&to=2026-09-30");
    expect(reg.openingBalance).toBe("1000000");
    expect(reg.rows.map((r) => r.balance)).toEqual(["2240000", "2237000", "2235200"]);
    expect([reg.totalIn, reg.totalOut]).toEqual(["1240000", "4800"]);

    // Unreconciled only keeps the same running balance.
    const unreconciled = await register(owner, bank.id, "?from=2026-09-01&to=2026-09-30&unreconciled=true");
    expect(unreconciled.rows.map((r) => r.balance)).toEqual(["2240000", "2237000", "2235200"]);
  });

  it("the balance matches the Balance Sheet for the same date", async () => {
    const reports = testApp.app.get(ReportsService);
    for (const asOf of ["2026-09-30", "2026-10-31"]) {
      const sheet = await reports.balanceSheet(orgId, asOf);
      const reg = await register(owner, bank.id, `?to=${asOf}`);
      expect(sheet.assets.find((a) => a.code === "1010")?.amount).toBe(reg.closingBalance);
    }
  });

  it("a card's register reads spent and paid off, and its balance is what's owed", async () => {
    const reg = await register(owner, card.id);
    // `out` is "Spent", `in` is "Paid off".
    expect(reg.rows.map((r) => [r.out, r.in, r.balance])).toEqual([
      ["6400", "0", "6400"],
      ["0", "3000", "3400"],
    ]);
  });

  it("an account with no entries says so", async () => {
    const reg = await register(owner, empty.id);
    expect(reg).toMatchObject({ rows: [], hasEntries: false, closingBalance: "0" });
  });

  it("needs banking.view: without it, 403 and no balances; Field never gets in", async () => {
    expect((await call(noView, `/money-accounts/${bank.id}/register`)).status).toBe(403);
    const names = (await (await call(noView, "/money-accounts")).json()) as MoneyAccount[];
    expect(names.length).toBeGreaterThan(0);
    expect(names[0]).not.toHaveProperty("balance");
    expect(names[0]).not.toHaveProperty("unreconciledCount");
    expect((await call(viewer, `/money-accounts/${bank.id}/register`)).status).toBe(200);
  });
});
