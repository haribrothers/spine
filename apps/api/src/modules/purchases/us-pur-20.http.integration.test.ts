import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenses, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { SELF_REVIEW_MESSAGE } from "./expenses.service";

type Who = { cookie: string; userId: string };

/**
 * US-PUR-20 — nobody but an Owner approves or rejects their own expense.
 * Two Staff approvers (both granted `expenses.approve` and
 * `expenses.reject`) and an Owner. Requires local Postgres.
 */
describe("US-PUR-20 · stop staff approving their own expenses (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const createdEmails: string[] = [];
  let orgId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const approver: Who = { cookie: "", userId: "" };
  const colleague: Who = { cookie: "", userId: "" };

  async function newUser(name: string): Promise<Who> {
    const email = `us-pur-20-${name}-${randomUUID()}@example.com`;
    createdEmails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function joinAsApprover(who: Who, teamId: string) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const [row] = await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() }).returning();
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    await db.insert(teamMemberships).values({ teamId, memberId: row!.id });
  }

  async function submittedBy(who: Who): Promise<string> {
    const [row] = await db
      .insert(expenses)
      .values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 8500n, submittedByUserId: who.userId, description: "Fuel" })
      .returning();
    return row!.id;
  }

  const review = (who: Who, id: string, action: "approve" | "reject") =>
    fetch(`${testApp.baseUrl}/expenses/${id}/${action}`, {
      method: "POST",
      headers: { cookie: who.cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" },
      body: JSON.stringify({ comment: action === "reject" ? "Missing receipt" : null }),
    });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    const [m] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = m!.organizationId;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: `Fuel ${randomUUID()}` }).returning();
    categoryId = category!.id;

    const [team] = await db.insert(teams).values({ orgId, name: `Approvers ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: team!.id, capability: "expenses.approve", granted: true },
      { teamId: team!.id, capability: "expenses.reject", granted: true },
    ]);
    Object.assign(approver, await newUser("approver"));
    await joinAsApprover(approver, team!.id);
    Object.assign(colleague, await newUser("colleague"));
    await joinAsApprover(colleague, team!.id);
  });

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
  });

  it("refuses a Staff member approving their own expense (403)", async () => {
    const id = await submittedBy(approver);
    const res = await review(approver, id, "approve");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toBe(SELF_REVIEW_MESSAGE);
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(row?.status).toBe("submitted");
  });

  it("refuses a Staff member rejecting their own expense (403)", async () => {
    const id = await submittedBy(approver);
    expect((await review(approver, id, "reject")).status).toBe(403);
  });

  it("lets a Staff approver approve a colleague's expense", async () => {
    const id = await submittedBy(colleague);
    expect((await review(approver, id, "approve")).status).toBeLessThan(300);
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(row?.status).toBe("approved");
  });

  it("lets an Owner approve their own expense", async () => {
    const id = await submittedBy(owner);
    expect((await review(owner, id, "approve")).status).toBeLessThan(300);
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(row?.status).toBe("approved");
  });
});
