import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, member, moneyAccounts, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-01 (D-140) — bank, cash and card accounts, each with its own
 * ledger account. Requires local Postgres.
 */
describe("US-BANK-01 · add my bank, cash and card accounts (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const list = async (who: Who) => (await (await call(who, "GET", "/money-accounts")).json()) as MoneyAccount[];

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-01-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;

    Object.assign(staff, await newUser("staff"));
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Bookkeepers ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "banking.view", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("starts with Bank Account (1010, default) and Cash in Hand (1000), each with a balance", async () => {
    const rows = await list(owner);
    expect(rows.map((r) => [r.code, r.name, r.kind, r.isDefault, r.balance])).toEqual([
      ["1000", "Cash in Hand", "cash", false, "0"],
      ["1010", "Bank Account", "bank", true, "0"],
    ]);
  });

  it("a bank account gets the next free asset code from 1011 and a zero balance", async () => {
    const res = await call(owner, "POST", "/money-accounts", { kind: "bank", name: "HDFC Current", bankName: "HDFC Bank", last4: "0193" });
    expect(res.status).toBe(201);
    const created = (await res.json()) as MoneyAccount;
    expect(created).toMatchObject({ code: "1011", kind: "bank", bankName: "HDFC Bank", last4: "0193", isDefault: false, balance: "0" });
    const [ledger] = await db.select().from(accounts).where(eq(accounts.id, created.accountId));
    expect(ledger).toMatchObject({ code: "1011", type: "asset", name: "HDFC Current" });
    expect((await list(owner)).find((r) => r.id === created.id)?.balance).toBe("0");

    // A cash box takes the next code in the same range, with no bank details.
    const cash = (await (await call(owner, "POST", "/money-accounts", { kind: "cash", name: "Site petty cash", bankName: "ignored", last4: "1234" })).json()) as MoneyAccount;
    expect(cash).toMatchObject({ code: "1012", bankName: null, last4: null });
  });

  it("a credit card is a liability from 2300 and its balance is what's owed", async () => {
    const card = (await (await call(owner, "POST", "/money-accounts", { kind: "card", name: "Business Visa", bankName: "First Coastal Bank", last4: "4410" })).json()) as MoneyAccount;
    expect(card.code).toBe("2300");
    const [ledger] = await db.select().from(accounts).where(eq(accounts.id, card.accountId));
    expect(ledger!.type).toBe("liability");
  });

  it("refuses a name another money account already uses", async () => {
    const res = await call(owner, "POST", "/money-accounts", { kind: "bank", name: "hdfc current" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("You already have an account called hdfc current. Choose another name.");
  });

  it("ticking default moves the Default badge from the previous default", async () => {
    const res = await call(owner, "POST", "/money-accounts", { kind: "bank", name: "First Coastal — Operating", isDefault: true });
    const created = (await res.json()) as MoneyAccount;
    const rows = await list(owner);
    expect(rows.filter((r) => r.isDefault).map((r) => r.id)).toEqual([created.id]);
    expect(rows.find((r) => r.code === "1010")?.isDefault).toBe(false);
  });

  it("renaming an account renames its ledger account and is audited", async () => {
    const [cash] = await db.select().from(moneyAccounts).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.name, "Site petty cash")));
    const res = await call(owner, "PUT", `/money-accounts/${cash!.id}`, { kind: "cash", name: "Site cash box" });
    expect(res.status).toBe(200);
    const [ledger] = await db.select().from(accounts).where(eq(accounts.id, cash!.accountId));
    expect(ledger!.name).toBe("Site cash box");
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "money_account"), eq(auditLog.entityId, cash!.id)));
    expect(audits.map((a) => a.action).sort()).toEqual(["create", "update"]);
  });

  it("Staff can't add or change accounts (Owner-only), but can list them", async () => {
    expect((await call(staff, "POST", "/money-accounts", { kind: "bank", name: "Sneaky account" })).status).toBe(403);
    const [cash] = await db.select().from(moneyAccounts).where(and(eq(moneyAccounts.orgId, orgId), eq(moneyAccounts.kind, "cash")));
    expect((await call(staff, "PUT", `/money-accounts/${cash!.id}`, { kind: "cash", name: "Renamed" })).status).toBe(403);
    expect((await list(staff)).length).toBeGreaterThan(2);
  });

  it("the dialog's hint gets the code each kind would take next", async () => {
    const codes = await (await call(owner, "GET", "/money-accounts/next-codes")).json();
    expect(codes).toEqual({ bank: "1014", cash: "1014", card: "2301" });
  });
});
