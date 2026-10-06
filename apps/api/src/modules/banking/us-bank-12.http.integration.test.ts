import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-12 — banking rights in the Team matrix: off for General Staff,
 * reconciling implies viewing, names-only pickers without `banking.view`,
 * and Field refused on every banking route. Requires local Postgres.
 */
describe("US-BANK-12 · let a Team see balances, record money and reconcile (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let generalStaffId: string;
  let bank: MoneyAccount;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const setPrivileges = async (privileges: { capability: string; granted: boolean }[]) => {
    const res = await call(owner, "PUT", `/org/teams/${generalStaffId}/privileges`, { privileges });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as Record<string, boolean>;
  };

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-12-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, role: "staff" | "field") {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role === "staff") await db.insert(teamMemberships).values({ teamId: generalStaffId, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    generalStaffId = (await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true))))[0]!.id;
    Object.assign(staff, await newUser("staff"));
    await join(staff, "staff");
    Object.assign(field, await newUser("field"));
    await join(field, "field");
    bank = ((await (await call(owner, "GET", "/money-accounts")).json()) as MoneyAccount[]).find((a) => a.code === "1010")!;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("General Staff start with every banking right off", async () => {
    const rows = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, generalStaffId), inArray(teamPrivileges.capability, ["banking.view", "banking.record", "banking.reconcile"])));
    expect(rows.map((r) => [r.capability, r.granted]).sort()).toEqual([
      ["banking.reconcile", false],
      ["banking.record", false],
      ["banking.view", false],
    ]);
  });

  it("without banking.view: the register is refused, but the payment picker still lists names", async () => {
    expect((await call(staff, "GET", `/money-accounts/${bank.id}/register`)).status).toBe(403);
    const names = (await (await call(staff, "GET", "/money-accounts")).json()) as MoneyAccount[];
    expect(names.map((a) => a.name)).toEqual(["Cash in Hand", "Bank Account"]);
    expect(names[0]).not.toHaveProperty("balance");
  });

  it("granting reconcile ticks view too; revoking view revokes reconcile", async () => {
    const afterGrant = await setPrivileges([{ capability: "banking.reconcile", granted: true }]);
    expect([afterGrant["banking.reconcile"], afterGrant["banking.view"]]).toEqual([true, true]);
    expect((await call(staff, "GET", `/money-accounts/${bank.id}/register`)).status).toBe(200);
    expect(((await (await call(staff, "GET", "/money-accounts")).json()) as MoneyAccount[])[0]).toHaveProperty("balance");

    const afterRevoke = await setPrivileges([{ capability: "banking.view", granted: false }]);
    expect([afterRevoke["banking.reconcile"], afterRevoke["banking.view"]]).toEqual([false, false]);
    expect((await call(staff, "GET", `/money-accounts/${bank.id}/register`)).status).toBe(403);
  });

  it("banking.record lets Staff record transfers and money in or out", async () => {
    const body = { fromMoneyAccountId: bank.id, toMoneyAccountId: (await (await call(owner, "GET", "/money-accounts")).json() as MoneyAccount[])[0]!.id, amount: "100", date: "2026-09-28" };
    expect((await call(staff, "POST", "/bank-transfers", body)).status).toBe(403);
    await setPrivileges([{ capability: "banking.record", granted: true }]);
    expect((await call(staff, "POST", "/bank-transfers", body)).status).toBe(201);
  });

  it("Field get 403 on every banking route", async () => {
    const id = bank.id;
    const routes: [string, string, unknown?][] = [
      ["GET", "/money-accounts"],
      ["GET", "/money-accounts/next-codes"],
      ["GET", "/money-accounts/last-used"],
      ["GET", `/money-accounts/${id}/register`],
      ["POST", "/money-accounts", { kind: "bank", name: "Field account" }],
      ["PUT", `/money-accounts/${id}`, { kind: "bank", name: "Renamed" }],
      ["POST", `/money-accounts/${id}/archive`],
      ["POST", `/money-accounts/${id}/restore`],
      ["POST", "/bank-transfers", { fromMoneyAccountId: id, toMoneyAccountId: id, amount: "1", date: "2026-09-28" }],
      ["DELETE", `/bank-transfers/${randomUUID()}`],
      ["POST", "/bank-transactions", { moneyAccountId: id, direction: "in", accountId: id, amount: "1", date: "2026-09-28" }],
      ["DELETE", `/bank-transactions/${randomUUID()}`],
    ];
    for (const [method, path, body] of routes) {
      expect((await call(field, method, path, body)).status, `${method} ${path}`).toBe(403);
    }
  });
});
