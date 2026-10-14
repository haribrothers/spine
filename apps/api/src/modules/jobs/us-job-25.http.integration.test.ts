import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, expenseCategories, expenses, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ExpensesService } from "../purchases/expenses.service";
import { QueueService } from "../queue/queue.service";

type Who = { cookie: string; userId: string };

/**
 * US-JOB-25 (D-125) — budget spent on the Costing tab and the Jobs list:
 * spent is the job's cost from journal lines; near at 80%, over above
 * 100%; list figures only for job-profitability viewers. Requires local
 * Postgres.
 */
describe("US-JOB-25 · see budget spent and get warned before going over (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let jobId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = async (who: Who, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  const budget = async () => (await call(owner, "GET", `/jobs/${jobId}/costing`)).json.budget;

  async function newUser(name: string): Promise<Who> {
    const email = `us-job-25-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    jobId = (await call(owner, "POST", "/jobs", { contactId: contact!.id, name: "Marina office fit-out", currency: "USD", contractValueAmount: "4850000" })).json.id as string;

    // 24,800.00 of approved cost tagged to the job.
    const [materials] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Materials", accountId: materials!.id }).returning();
    const [expense] = await db
      .insert(expenses)
      .values({ orgId, categoryId: category!.id, jobId, date: new Date(), currency: "USD", amount: 2480000n, submittedByUserId: owner.userId, description: "Plasterboard and studs" })
      .returning();
    await testApp.app.get(ExpensesService).approve(orgId, expense!.id, owner.userId, null);

    Object.assign(staff, await newUser("staff"));
    await db.delete(member).where(eq(member.userId, staff.userId));
    const staffMemberId = randomUUID();
    await db.insert(member).values({ id: staffMemberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    // US-TEAM-30: their Team opens Jobs, without job profitability.
    const [team] = await db.insert(teams).values({ orgId, name: `Jobs ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "jobs.open", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId: staffMemberId });
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("without a budget the card has nothing to compare: state 'none'", async () => {
    expect(await budget()).toEqual({ amount: null, spent: "2480000", remaining: null, usedPct: null, state: "none" });
  });

  it("a 32,000.00 budget with 24,800.00 of cost: 7,200.00 remaining, 78% used", async () => {
    await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: "3200000" });
    expect(await budget()).toEqual({ amount: "3200000", spent: "2480000", remaining: "720000", usedPct: 78, state: "ok" });
  });

  it("at 80% or more it's 'near'; past the budget it's 'over' with a negative remaining", async () => {
    await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: "2900000" });
    expect(await budget()).toMatchObject({ usedPct: 86, state: "near" });
    await call(owner, "PUT", `/jobs/${jobId}`, { costBudgetAmount: "2335000" });
    expect(await budget()).toMatchObject({ remaining: "-145000", state: "over" });
  });

  it("the Jobs list adds budget used for job-profitability viewers only", async () => {
    const forOwner = (await call(owner, "GET", "/jobs?include=costing")).json as unknown as Record<string, unknown>[];
    expect(forOwner.find((j) => j.id === jobId)).toMatchObject({ budgetUsedPct: 106, budgetState: "over" });
    const plain = (await call(owner, "GET", "/jobs")).json as unknown as Record<string, unknown>[];
    expect(plain.find((j) => j.id === jobId)).not.toHaveProperty("budgetState");
    const forStaff = (await call(staff, "GET", "/jobs?include=costing")).json as unknown as Record<string, unknown>[];
    expect(forStaff.find((j) => j.id === jobId)).not.toHaveProperty("budgetState");
  });
});
