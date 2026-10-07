import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BANK_TRANSACTION_SHORTCUTS, type AccountRegister, type BankTransaction, type MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, bankTransactions, contacts, journalLines, member, session as sessionTable, taxRates, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-05 — money in or out with no invoice or bill posts P22 against a
 * category that's never a control account. Requires local Postgres.
 */
describe("US-BANK-05 · record money in or out that has no invoice or bill (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  let gstId: string;
  let bankContactId: string;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
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
  const record = (body: Record<string, unknown>, who: Who = owner) => call(who, "POST", "/bank-transactions", { moneyAccountId: bank.id, date: "2026-09-30", ...body });
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const linesOf = async (id: string) => {
    const [row] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, id));
    const lines = await db.select({ accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit, code: accounts.code }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(eq(journalLines.entryId, row!.entryId));
    return lines.map((l) => [l.code, l.debit, l.credit]).sort();
  };
  const bankBalance = async () => (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.id === bank.id)!.balance;

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-05-${name}-${randomUUID()}@example.com`;
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

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(viewer, await newUser("viewer"));
    await join(viewer, "staff", ["banking.view"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");

    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [gst] = await db.insert(taxRates).values({ orgId, name: "GST 18%", rate: 18 }).returning();
    gstId = gst!.id;
    const [firstCoastal] = await db.insert(contacts).values({ orgId, type: "vendor", name: "First Coastal Bank", createdByUserId: owner.userId }).returning();
    bankContactId = firstCoastal!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("every shortcut points at an account a new organisation has", () => {
    for (const shortcut of BANK_TRANSACTION_SHORTCUTS) expect(code[shortcut.code], shortcut.label).toBeDefined();
  });

  it("money in posts Dr the money account / Cr the category and reads 'Money in — <category>'", async () => {
    const res = await record({ direction: "in", accountId: code["3000"], amount: "1000000", contactId: bankContactId, description: "Capital top-up" });
    expect(res.status).toBe(201);
    const created = await json<BankTransaction>(res);
    expect(created).toMatchObject({ direction: "in", account: { code: "3000", name: "Owner's Capital" }, amount: "1000000", taxAmount: "0" });
    expect(await linesOf(created.id)).toEqual([
      ["1010", 1000000n, 0n],
      ["3000", 0n, 1000000n],
    ].sort());
    const reg = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(reg.rows.find((r) => r.sourceId === created.id)).toMatchObject({ what: "Money in — Owner's Capital", reference: "Capital top-up", contact: { name: "First Coastal Bank" }, in: "1000000" });
  });

  it("bank charges with 18% GST put the tax part in 1200 Input Tax Receivable", async () => {
    const created = await json<BankTransaction>(await record({ direction: "out", accountId: code["6900"], amount: "1180", taxRateId: gstId, description: "September account fees" }));
    expect(created.taxAmount).toBe("180");
    expect(await linesOf(created.id)).toEqual([
      ["6900", 1000n, 0n],
      ["1200", 180n, 0n],
      ["1010", 0n, 1180n],
    ].sort());
    const reg = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(reg.rows.find((r) => r.sourceId === created.id)).toMatchObject({ what: "Money out — Other Expenses", out: "1180" });
  });

  it("refuses control accounts, a money account as the category, and tax on money in", async () => {
    for (const c of ["1100", "1150", "1200", "2000", "2100", "2200"]) {
      const res = await record({ direction: "out", accountId: code[c], amount: "100" });
      expect(res.status, c).toBe(400);
      expect(await message(res)).toBe("Use a payment, bill or tax payment for this.");
    }
    const cash = await record({ direction: "in", accountId: code["1000"], amount: "100" });
    expect(await message(cash)).toBe("Use a transfer between your accounts for this.");
    const taxedIn = await record({ direction: "in", accountId: code["4800"], amount: "100", taxRateId: gstId });
    expect(taxedIn.status).toBe(400);
    expect(await message(taxedIn)).toBe("Tax applies to money out only.");
  });

  it("deleting an entry posts a reversing entry and the balance goes back", async () => {
    const before = await bankBalance();
    const created = await json<BankTransaction>(await record({ direction: "out", accountId: code["3100"], amount: "250000" }));
    expect(await bankBalance()).toBe(String(BigInt(before!) - 250000n));
    expect((await call(owner, "DELETE", `/bank-transactions/${created.id}`)).status).toBe(200);
    expect(await bankBalance()).toBe(before);

    const reg = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(reg.rows.filter((r) => r.sourceId === created.id).map((r) => [r.what, r.deleted])).toEqual([
      ["Money out — Owner's Drawings", true],
      ["Money out deleted — Owner's Drawings", true],
    ]);
    expect((await call(owner, "DELETE", `/bank-transactions/${created.id}`)).status).toBe(400);
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "bank_transaction"), eq(auditLog.entityId, created.id)));
    expect(audits.map((a) => a.action).sort()).toEqual(["created", "deleted"]);
  });

  it("needs banking.record; Field never", async () => {
    const body = { direction: "in", accountId: code["4800"], amount: "100" };
    expect((await record(body, viewer)).status).toBe(403);
    expect((await record(body, field)).status).toBe(403);
  });
});
