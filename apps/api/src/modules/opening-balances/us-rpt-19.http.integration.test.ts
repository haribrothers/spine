import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, OpeningBalancesView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, fiscalPeriods, member, openingBalances, session as sessionTable, teamMemberships, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-19 — lock the opening balances (a closed period up to the day before the cutover date), and unlock them. Requires local Postgres. */
describe("US-RPT-19 · check and lock my opening balances (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  let bank: MoneyAccount;
  let customer: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const balances = { cutoverDate: "2026-07-01", lines: [] as { accountId: string; debit: string; credit: string }[] };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      const email = `us-rpt-19-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    customer = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Maple Ridge Developments" }))).id;
    balances.lines = [
      { accountId: code["1010"]!, debit: "100000", credit: "0" },
      { accountId: code["3000"]!, debit: "0", credit: "90000" },
    ];
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("can't lock before anything is entered", async () => {
    expect(await message(await call(owner, "POST", "/opening-balances/lock"))).toBe("Enter your opening balances before locking them.");
  });

  it("locking closes everything up to the day before the cutover date and makes the opening balances read-only", async () => {
    await json(await call(owner, "PUT", "/opening-balances", balances));
    const view = await json<OpeningBalancesView>(await call(owner, "POST", "/opening-balances/lock"));
    expect(view).toMatchObject({ status: "locked", adjustment: "10000" });
    expect(view.lockedAt).toEqual(expect.any(String));
    const [row] = await db.select().from(openingBalances).where(eq(openingBalances.orgId, orgId));
    const [period] = await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.id, row!.fiscalPeriodId!));
    expect(period).toMatchObject({ startDate: "1900-01-01", endDate: "2026-06-30", isClosed: true });
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "opening_balances"), eq(auditLog.action, "locked"), eq(auditLog.entityId, orgId)));
    expect(audit!.changes).toMatchObject({ cutoverDate: "2026-07-01", openingBalanceAdjustments: "10000" });

    expect(await message(await call(owner, "PUT", "/opening-balances", balances))).toBe("Unlock the opening balances to change them.");
    expect(await message(await call(owner, "POST", "/opening-balances/invoices", { contactId: customer, number: "OLD-1", invoiceDate: "2026-06-01", dueDate: "2026-06-30", amountDue: "100" }))).toBe(
      "Unlock the opening balances to change them.",
    );
    expect(await message(await call(owner, "POST", "/opening-balances/customer-credits", { contactId: customer, amount: "100" }))).toBe("Unlock the opening balances to change them.");
    // Nothing more is posted before the cutover date; after it is fine.
    const before = await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount: "100", date: "2026-06-15" });
    expect(before.status).toBe(400);
    expect(await message(before)).toMatch(/falls within a closed fiscal period/);
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount: "100", date: "2026-07-02" }));
  });

  it("unlocking reopens the period and allows editing; locking again reuses it", async () => {
    const view = await json<OpeningBalancesView>(await call(owner, "POST", "/opening-balances/unlock"));
    expect(view.status).toBe("draft");
    const [row] = await db.select().from(openingBalances).where(eq(openingBalances.orgId, orgId));
    expect((await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.id, row!.fiscalPeriodId!)))[0]!.isClosed).toBe(false);
    expect((await db.select().from(auditLog).where(and(eq(auditLog.entityType, "opening_balances"), eq(auditLog.action, "unlocked")))).length).toBeGreaterThan(0);
    await json(await call(owner, "POST", "/opening-balances/customer-credits", { contactId: customer, amount: "10000" }));
    await json(await call(owner, "POST", "/opening-balances/lock"));
    expect((await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.orgId, orgId))).length).toBe(1);
    expect(await message(await call(owner, "POST", "/opening-balances/lock"))).toBe("The opening balances are already locked.");
  });

  it("Staff get 403", async () => {
    expect((await call(staff, "POST", "/opening-balances/unlock")).status).toBe(403);
    expect((await call(staff, "POST", "/opening-balances/lock")).status).toBe(403);
  });
});
