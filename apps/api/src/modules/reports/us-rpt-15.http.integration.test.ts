import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, expenseCategories, expenses, invoices, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { ExpensesService } from "../purchases/expenses.service";
import { QueueService } from "../queue/queue.service";

type Row = { jobId: string; status: string; contractValueAmount: string; billedToDate: string; billedPct: number | null; cost: string; costBudget: string | null; budgetUsedPct: number | null; budgetState: string };

/**
 * US-RPT-15 (D-127) — Job Profitability rows gain billed to date, billed %,
 * the cost budget and budget used (the same figures as each job's Costing
 * tab), a status filter defaulting to active and on hold, and the same
 * columns in the CSV. Requires local Postgres.
 */
describe("US-RPT-15 · compare contract, billed and cost across jobs (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-rpt-15-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  let activeJob: string;
  let completedJob: string;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  };
  const report = async (query = "") => ((await (await call("GET", `/reports/job-profitability${query}`)).json()) as { jobs: Row[] }).jobs;

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: userId }).returning();
    const job = async (name: string) => ((await (await call("POST", "/jobs", { contactId: contact!.id, name, currency: "USD", contractValueAmount: "4850000" })).json()) as { id: string }).id;
    activeJob = await job("Marina office fit-out");
    completedJob = await job("Hotel lobby renovation");
    await call("PUT", `/jobs/${activeJob}`, { costBudgetAmount: "3200000" });
    await call("PUT", `/jobs/${completedJob}`, { status: "completed" });

    // 40% billed and 24,800.00 of cost on the active job.
    const invoicesService = testApp.app.get(InvoicesService);
    const draft = await invoicesService.create(orgId, userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "USD", lines: [{ name: "Claim", quantity: 1, unitPriceAmount: "1940000" }] }));
    await db.update(invoices).set({ jobId: activeJob, type: "progress" }).where(eq(invoices.id, draft.id));
    await invoicesService.issue(orgId, draft.id, userId);
    const [materials] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Materials", accountId: materials!.id }).returning();
    const [expense] = await db.insert(expenses).values({ orgId, categoryId: category!.id, jobId: activeJob, date: new Date(), currency: "USD", amount: 2480000n, submittedByUserId: userId }).returning();
    await testApp.app.get(ExpensesService).approve(orgId, expense!.id, userId, null);
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("rows gain billed to date, billed %, the budget and budget used — the same as the job's Costing tab", async () => {
    const [row] = await report();
    expect(row).toMatchObject({ jobId: activeJob, billedToDate: "1940000", billedPct: 40, cost: "2480000", costBudget: "3200000", budgetUsedPct: 78, budgetState: "ok" });
    const costing = (await (await call("GET", `/jobs/${activeJob}/costing`)).json()) as { billing: { billedToDate: string; billedPct: number }; budget: { usedPct: number } };
    expect([row!.billedToDate, row!.billedPct, row!.budgetUsedPct]).toEqual([costing.billing.billedToDate, costing.billing.billedPct, costing.budget.usedPct]);
  });

  it("the status filter defaults to active and on hold", async () => {
    expect((await report()).map((r) => r.jobId)).toEqual([activeJob]);
    expect((await report("?status=completed")).map((r) => r.jobId)).toEqual([completedJob]);
    expect((await report("?status=all")).map((r) => r.jobId).sort()).toEqual([activeJob, completedJob].sort());
  });

  it("the CSV gains the same columns, as plain numbers", async () => {
    const csv = await (await call("GET", "/reports/job-profitability/export.csv?status=all")).text();
    const [header, ...lines] = csv.trim().split(/\r?\n/);
    expect(header).toBe("Job,Status,Currency,Contract value,Billed to date,Billed %,Budget used %,Revenue,Cost,Margin,Margin %");
    expect(lines.find((l) => l.startsWith("Marina office fit-out"))).toBe("Marina office fit-out,active,USD,48500.00,19400.00,40,78,19400.00,24800.00,-5400.00,-27.83");
  });
});
