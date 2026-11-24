import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-06 — archiving an account with a zero balance takes it out of
 * every picker and keeps its history; restore brings it back. Requires
 * local Postgres.
 */
describe("US-BANK-06 · archive an account I no longer use (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let contactId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

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
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const list = async (query = "") => json<MoneyAccount[]>(await call(owner, "GET", `/money-accounts${query}`));

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-06-${name}-${randomUUID()}@example.com`;
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
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "banking.record", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    bank = (await list()).find((a) => a.code === "1010")!;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("refuses an account with money in it", async () => {
    const old = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "bank", name: "Old savings" }));
    await json(await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: old.id, amount: "100000", date: "2026-09-01" }));
    const res = await call(owner, "POST", `/money-accounts/${old.id}/archive`);
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Move the $1,000.00 out of this account before archiving it.");
    expect((await list()).some((a) => a.id === old.id)).toBe(true);
  });

  it("refuses the default account", async () => {
    const res = await call(owner, "POST", `/money-accounts/${bank.id}/archive`);
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Choose another default account first.");
  });

  it("a zero-balance account leaves every picker, keeps its history, and restores", async () => {
    const old = (await list()).find((a) => a.name === "Old savings")!;
    await json(await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: old.id, toMoneyAccountId: bank.id, amount: "100000", date: "2026-09-02" }));
    const archived = await json<MoneyAccount>(await call(owner, "POST", `/money-accounts/${old.id}/archive`));
    expect(archived.archivedAt).not.toBeNull();

    expect((await list()).some((a) => a.id === old.id)).toBe(false);
    expect((await json<MoneyAccount[]>(await call(staff, "GET", "/money-accounts"))).some((a) => a.id === old.id)).toBe(false);
    expect((await list("?includeArchived=true")).find((a) => a.id === old.id)?.archivedAt).not.toBeNull();
    const pay = await call(owner, "POST", "/payments", { contactId, date: "2026-09-03", method: "cash", currency: "USD", amount: "500", moneyAccountId: old.id });
    expect(await message(pay)).toBe("Choose one of your active accounts.");
    const register = await json<{ rows: unknown[] }>(await call(owner, "GET", `/money-accounts/${old.id}/register`));
    expect(register.rows).toHaveLength(2);

    await json(await call(owner, "POST", `/money-accounts/${old.id}/restore`));
    expect((await list()).some((a) => a.id === old.id)).toBe(true);
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "money_account"), eq(auditLog.entityId, old.id)));
    expect(audits.map((a) => a.action).sort()).toEqual(["archived", "create", "restored"]);
  });

  it("can't restore over a name an active account now uses", async () => {
    const spare = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "cash", name: "Petty cash" }));
    await json(await call(owner, "POST", `/money-accounts/${spare.id}/archive`));
    await json(await call(owner, "POST", "/money-accounts", { kind: "cash", name: "Petty cash" }));
    const res = await call(owner, "POST", `/money-accounts/${spare.id}/restore`);
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("You already have an account called Petty cash. Choose another name.");
  });

  it("Staff can't archive or restore", async () => {
    const old = (await list()).find((a) => a.name === "Old savings")!;
    expect((await call(staff, "POST", `/money-accounts/${old.id}/archive`)).status).toBe(403);
    expect((await call(staff, "POST", `/money-accounts/${old.id}/restore`)).status).toBe(403);
  });
});
