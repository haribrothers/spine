import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, expenseCategories, expenseLabourLines, journalLines, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";

/**
 * US-PUR-23 (D-126) — labour expenses: rows of trade × workers × day rate,
 * the amount checked against them, a job required, trades suggested with
 * their last rate, and approval posting like any expense. Requires local
 * Postgres.
 */
describe("US-PUR-23 · enter site labour as headcount × day rate (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pur-23-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let jobId: string;
  let categoryId: string;
  let labourAccountId: string;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> & { message?: string } };
  };
  const ROWS = [
    { trade: "Mason", headcount: 4, dayRateAmount: "95000" },
    { trade: "Carpenter", headcount: 3, dayRateAmount: "90000" },
    { trade: "Helper", headcount: 8, dayRateAmount: "65000" },
  ];
  const labour = (overrides: Record<string, unknown> = {}) => ({
    categoryId,
    jobId,
    date: "2026-10-05",
    currency: "USD",
    amount: "1170000",
    entryMode: "labour",
    labourLines: ROWS,
    description: "Day labour — slab formwork, level 2",
    ...overrides,
  });

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    jobId = (await call("POST", "/jobs", { contactId: contact!.id, name: "Marina office fit-out", currency: "USD" })).json.id as string;
    const [account] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5200")));
    labourAccountId = account!.id;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Site labour", accountId: labourAccountId }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("saves the rows and an amount of 11,700.00, and lists each row on the expense", async () => {
    const res = await call("POST", "/expenses", labour());
    expect(res.status).toBeLessThan(300);
    expect(res.json).toMatchObject({ amount: "1170000", entryMode: "labour", jobId });
    expect((res.json.labourLines as Record<string, unknown>[]).map((l) => [l.trade, l.headcount, l.dayRateAmount, l.lineAmount])).toEqual([
      ["Mason", 4, "95000", "380000"],
      ["Carpenter", 3, "90000", "270000"],
      ["Helper", 8, "65000", "520000"],
    ]);
  });

  it("refuses an amount that disagrees with the rows", async () => {
    const res = await call("POST", "/expenses", labour({ amount: "1200000" }));
    expect(res.status).toBe(400);
    expect(res.json.message).toBe("The amount must equal the labour rows' total, 11700.00.");
  });

  it("labour is always for a job, and every row must be complete", async () => {
    expect((await call("POST", "/expenses", labour({ jobId: null }))).json.message).toBe("Labour is always for a job — choose one.");
    const bad = await call("POST", "/expenses", labour({ labourLines: [{ trade: "", headcount: 4, dayRateAmount: "95000" }] }));
    expect(bad.status).toBe(400);
    expect(bad.json.message).toBe("Every row needs a trade, at least one worker and a day rate.");
    expect((await call("POST", "/expenses", labour({ labourLines: [] }))).json.message).toBe("Every row needs a trade, at least one worker and a day rate.");
  });

  it("suggests trades used before with their last day rate", async () => {
    await call("POST", "/expenses", labour({ amount: "400000", labourLines: [{ trade: "Mason", headcount: 4, dayRateAmount: "100000" }] }));
    const trades = (await call("GET", "/expenses/labour-trades?q=mas")).json as unknown as { trade: string; lastDayRateAmount: string }[];
    expect(trades).toEqual([{ trade: "Mason", lastDayRateAmount: "100000" }]);
  });

  it("approved, it posts like any expense to the category's account, tagged to the job", async () => {
    const created = (await call("POST", "/expenses", labour())).json;
    expect((await call("POST", `/expenses/${created.id}/approve`, { comment: null })).status).toBeLessThan(300);
    const approved = (await call("GET", `/expenses/${created.id}`)).json;
    const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, approved.journalEntryId as string));
    expect(lines.find((l) => l.accountId === labourAccountId)).toMatchObject({ debit: 1170000n, jobId });
    expect(await db.select().from(expenseLabourLines).where(eq(expenseLabourLines.expenseId, created.id as string))).toHaveLength(3);
  });
});
