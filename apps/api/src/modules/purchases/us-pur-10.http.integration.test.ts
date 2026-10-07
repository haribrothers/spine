import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-PUR-10 — a submitted expense can be edited (and stays submitted) or deleted; a reviewed one can't. Requires local Postgres. */
describe("US-PUR-10 · edit or delete my submitted expense (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const submit = async (who: Who, amount = "5000") =>
    json<{ id: string; status: string }>(await call(who, "POST", "/expenses", { categoryId, date: "2026-10-05", currency: "USD", amount, description: "Fuel" }));

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
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [field, "field"]] as const) {
      const email = `us-pur-10-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(staff, "staff", ["expenses.edit_own", "expenses.delete_own"]);
    await join(field, "field");
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel & freight", accountId: other!.id }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("editing my submitted expense updates it and it stays Submitted", async () => {
    const expense = await submit(staff);
    const updated = await json<{ amount: string; description: string; status: string }>(await call(staff, "PUT", `/expenses/${expense.id}`, { amount: "6500", description: "Fuel and tolls" }));
    expect(updated).toMatchObject({ amount: "6500", description: "Fuel and tolls", status: "submitted" });
    expect((await call(staff, "DELETE", `/expenses/${expense.id}`)).status).toBe(200);
  });

  it("an approved or rejected expense can't be edited", async () => {
    const approved = await submit(staff);
    await json(await call(owner, "POST", `/expenses/${approved.id}/approve`, {}));
    const rejected = await submit(staff);
    await json(await call(owner, "POST", `/expenses/${rejected.id}/reject`, { comment: "Duplicate" }));
    for (const id of [approved.id, rejected.id]) {
      const res = await call(owner, "PUT", `/expenses/${id}`, { amount: "1" });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("Only a submitted expense can be edited — an approved expense has already posted to the ledger.");
    }
  });

  it("without 'edit others'' a colleague's expense is refused; Field edit and delete only their own", async () => {
    const owners = await submit(owner);
    expect((await call(staff, "PUT", `/expenses/${owners.id}`, { amount: "1" })).status).toBe(403);
    expect((await call(field, "PUT", `/expenses/${owners.id}`, { amount: "1" })).status).toBe(403);
    expect((await call(field, "DELETE", `/expenses/${owners.id}`)).status).toBe(403);
    const fields = await submit(field);
    expect((await call(field, "PUT", `/expenses/${fields.id}`, { amount: "7000" })).status).toBe(200);
    expect((await call(field, "DELETE", `/expenses/${fields.id}`)).status).toBe(200);
    // The Owner can edit anyone's submitted expense.
    expect((await call(owner, "PUT", `/expenses/${(await submit(staff)).id}`, { amount: "1234" })).status).toBe(200);
  });
});
