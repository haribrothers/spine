import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, expenseCategories, expenses, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ExpensesService } from "../purchases/expenses.service";
import { QueueService } from "../queue/queue.service";

type Row = { accountId: string; code: string; name: string; amount: string; sharePct: number };

/**
 * US-JOB-26 — a job's cost by the expense account it posted to, from
 * journal lines (D-011): largest first, adding up to Cost exactly, and the
 * account drill-down filtered to the job. Requires local Postgres.
 */
describe("US-JOB-26 · see a job's cost by category (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-job-26-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  let jobId: string;
  let otherJobId: string;
  const accountIds: Record<string, string> = {};

  const get = async (path: string) => (await fetch(`${testApp.baseUrl}${path}`, { headers: { cookie } })).json() as Promise<Record<string, unknown>>;

  async function approvedExpense(code: string, amount: bigint, forJob: string) {
    const [category] = await db.insert(expenseCategories).values({ orgId, name: `${code} ${randomUUID().slice(0, 4)}`, accountId: accountIds[code]! }).returning();
    const [row] = await db.insert(expenses).values({ orgId, categoryId: category!.id, jobId: forJob, date: new Date(), currency: "USD", amount, submittedByUserId: userId }).returning();
    await testApp.app.get(ExpensesService).approve(orgId, row!.id, userId, null);
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    for (const a of await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.code, ["5000", "5100", "5200"])))) accountIds[a.code] = a.id;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: userId }).returning();
    const post = async (name: string) =>
      (
        (await (
          await fetch(`${testApp.baseUrl}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
            body: JSON.stringify({ contactId: contact!.id, name, currency: "USD", contractValueAmount: "4850000" }),
          })
        ).json()) as { id: string }
      ).id;
    jobId = await post("Marina office fit-out");
    otherJobId = await post("Phase 2 townhomes");
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("a job with no cost has no categories", async () => {
    expect((await get(`/jobs/${jobId}/costing`)).byCategory).toEqual([]);
  });

  it("lists each expense account with its amount and share, largest first, adding up to Cost exactly", async () => {
    await approvedExpense("5100", 645000n, jobId);
    await approvedExpense("5000", 700000n, jobId);
    await approvedExpense("5000", 420000n, jobId);
    await approvedExpense("5200", 418000n, jobId);
    await approvedExpense("5000", 99900n, otherJobId);

    const report = (await get(`/jobs/${jobId}/costing`)) as { cost: string; byCategory: Row[] };
    expect(report.byCategory.map((r) => [r.code, r.name, r.amount, r.sharePct])).toEqual([
      ["5000", "Cost of Materials", "1120000", 51],
      ["5100", "Subcontractor Costs", "645000", 30],
      ["5200", "Direct Labour", "418000", 19],
    ]);
    expect(report.byCategory.reduce((sum, r) => sum + BigInt(r.amount), 0n)).toBe(BigInt(report.cost));
  });

  it("the account drill-down can be filtered to the job", async () => {
    const all = (await get(`/reports/account-drilldown?accountId=${accountIds["5000"]}&from=2000-01-01&to=2999-12-31`)) as { entries: { debit: string }[] };
    const onJob = (await get(`/reports/account-drilldown?accountId=${accountIds["5000"]}&from=2000-01-01&to=2999-12-31&jobId=${jobId}`)) as { entries: { debit: string }[] };
    expect(all.entries).toHaveLength(3);
    expect(onJob.entries.map((e) => e.debit).sort()).toEqual(["420000", "700000"]);
  });
});
