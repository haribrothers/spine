import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-DASH-23 — the Accounts card reads every account's balance and reconciled date, only with banking.view. Requires local Postgres. */
describe("US-DASH-23 · see each bank, cash and card balance (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const banker: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };

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
    for (const [who, name] of [[owner, "owner"], [banker, "banker"], [plain, "plain"]] as const) {
      const email = `us-dash-23-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(banker, ["banking.view"]);
    await join(plain, ["reports.view_receivables"]);
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const card = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "card", name: "Business Visa" }));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["3000"], amount: "4821240", date: "2026-09-01" }));
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: card.id, direction: "out", accountId: code["6300"], amount: "128460", date: "2026-09-02" }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("each active account comes with its kind, balance (a card's is what's owed) and reconciled date", async () => {
    const rows = await json<MoneyAccount[]>(await call(banker, "GET", "/money-accounts"));
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Business Visa"]).toMatchObject({ kind: "card", balance: "128460", lastReconciledOn: null });
    expect(rows.find((r) => r.code === "1010")).toMatchObject({ kind: "bank", balance: "4821240" });
    expect(rows.find((r) => r.code === "1000")).toMatchObject({ kind: "cash", balance: "0" });
  });

  it("without 'View banking' there are no balances to show", async () => {
    const rows = await json<MoneyAccount[]>(await call(plain, "GET", "/money-accounts"));
    for (const r of rows) expect(r.balance).toBeUndefined();
  });
});
