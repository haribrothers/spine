import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UnbilledWork } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, expenses, jobs, member, milestones, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-DASH-24 — completed milestones not invoiced and approved billable expenses not billed; gated by reports.view_receivables. Requires local Postgres. */
describe("US-DASH-24 · see work not yet billed (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const arStaff: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };
  const ids = {} as Record<"job" | "cancelled", string>;

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
    for (const [who, name] of [[owner, "owner"], [arStaff, "ar"], [plain, "plain"]] as const) {
      const email = `us-dash-24-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(arStaff, ["reports.view_receivables"]);
    await join(plain, ["reports.view_payables"]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("with nothing done yet, both are empty", async () => {
    expect(await json<UnbilledWork>(await call(owner, "GET", "/dashboard/unbilled"))).toEqual({ milestones: { count: 0, amount: "0", jobs: [] }, billableExpenses: { count: 0, amount: "0" } });
  });

  it("counts completed milestones not invoiced, by job, and approved billable expenses not billed at what they'd invoice for", async () => {
    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [job] = await db.insert(jobs).values({ orgId, contactId: customer!.id, name: "Hotel lobby renovation", number: "JOB-001", currency: "USD", status: "active" }).returning();
    const [cancelled] = await db.insert(jobs).values({ orgId, contactId: customer!.id, name: "Abandoned fit-out", number: "JOB-002", currency: "USD", status: "cancelled" }).returning();
    [ids.job, ids.cancelled] = [job!.id, cancelled!.id];
    await db.insert(milestones).values([
      { orgId, jobId: job!.id, name: "Demolition", status: "completed", amountType: "fixed", amount: 900000, resolvedAmount: 900000n },
      { orgId, jobId: job!.id, name: "Framing", status: "completed", amountType: "fixed", amount: 530000, resolvedAmount: 530000n },
      { orgId, jobId: job!.id, name: "Finishes", status: "pending", amountType: "fixed", amount: 400000, resolvedAmount: 400000n },
      { orgId, jobId: job!.id, name: "Design", status: "invoiced", amountType: "fixed", amount: 200000, resolvedAmount: 200000n },
      { orgId, jobId: cancelled!.id, name: "Never", status: "completed", amountType: "fixed", amount: 100000, resolvedAmount: 100000n },
    ]);
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Materials" }).returning();
    const expense = (amount: bigint, taxAmount: bigint, status: "approved" | "submitted", isBillable: boolean) => ({ orgId, categoryId: category!.id, date: new Date("2026-09-20"), currency: "USD", amount, taxAmount, status, isBillable });
    await db.insert(expenses).values([expense(50000n, 5000n, "approved", true), expense(6240n, 0n, "approved", true), expense(99900n, 0n, "submitted", true), expense(70000n, 0n, "approved", false)]);

    const work = await json<UnbilledWork>(await call(owner, "GET", "/dashboard/unbilled"));
    expect(work.milestones).toEqual({ count: 2, amount: "1430000", jobs: [{ id: job!.id, name: "Hotel lobby renovation", number: "JOB-001", count: 2, amount: "1430000" }] });
    expect(work.billableExpenses).toEqual({ count: 2, amount: "61240" });
  });

  it("with Jobs & field switched off, only billable expenses", async () => {
    await json(await call(owner, "PUT", "/org/settings/modules", { value: { leadsMeetings: true, jobsField: false, approvals: true, recurring: true } }));
    const work = await json<UnbilledWork>(await call(owner, "GET", "/dashboard/unbilled"));
    expect(work.milestones).toBeNull();
    expect(work.billableExpenses.count).toBe(2);
    await json(await call(owner, "PUT", "/org/settings/modules", { value: { leadsMeetings: true, jobsField: true, approvals: true, recurring: true } }));
  });

  it("needs 'View receivables'", async () => {
    expect((await call(arStaff, "GET", "/dashboard/unbilled")).status).toBe(200);
    expect((await call(plain, "GET", "/dashboard/unbilled")).status).toBe(403);
  });
});
