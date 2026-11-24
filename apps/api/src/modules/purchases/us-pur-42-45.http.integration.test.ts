import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ExpenseActivityEntry, PossibleDuplicateExpense } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";

/**
 * US-PUR-42, US-PUR-43, US-PUR-44, US-PUR-45 (D-227) — the list's names and
 * order, an expense's Activity, the same-amount-same-day warning, and fixing
 * and resubmitting a rejected expense. Requires local Postgres.
 */
describe("US-PUR-42 to US-PUR-45 · expenses you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let cookie: string;
  let categoryId: string;

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-42-${randomUUID()}@example.com`;
    emails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: `Fuel ${randomUUID()}` }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PUR-42: the list carries who submitted it, newest by date first", async () => {
    const older = await json<{ id: string }>(await call("POST", "/expenses", { categoryId, date: "2026-09-01", currency: "USD", amount: "1200", taxAmount: "0", paidBy: "company" }));
    const newer = await json<{ id: string }>(await call("POST", "/expenses", { categoryId, date: "2026-10-09", currency: "USD", amount: "1300", taxAmount: "0", paidBy: "company" }));
    const rows = await json<{ id: string; date: string; submittedByName: string | null; jobName: string | null; billedInvoiceNumber: string | null }[]>(await call("GET", "/expenses"));
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(rows.find((r) => r.id === newer.id)).toMatchObject({ submittedByName: "Priya Raman", jobName: null, billedInvoiceNumber: null });
  });

  it("US-PUR-43, US-PUR-45: Activity keeps the rejection when it's fixed and resubmitted; approved can't be edited", async () => {
    const expense = await json<{ id: string }>(await call("POST", "/expenses", { categoryId, date: "2026-10-03", currency: "USD", amount: "12000", taxAmount: "0", paidBy: "employee", description: "Taxi" }));
    await json(await call("PUT", `/expenses/${expense.id}`, { description: "Taxi to the steel supplier" }));
    await json(await call("POST", `/expenses/${expense.id}/reject`, { comment: "Use the site van for supplier runs." }));

    // Fix and resubmit: back to waiting, the reviewer's fields cleared.
    const resubmitted = await json<{ status: string; reviewComment: string | null; rejectedAt: string | null }>(await call("PUT", `/expenses/${expense.id}`, { amount: "9000" }));
    expect(resubmitted).toMatchObject({ status: "submitted", reviewComment: null, rejectedAt: null });

    await json(await call("POST", `/expenses/${expense.id}/approve`, { comment: "Fine this once." }));
    const activity = await json<ExpenseActivityEntry[]>(await call("GET", `/expenses/${expense.id}/activity`));
    expect(activity.map((a) => a.type)).toEqual(["approved", "resubmitted", "rejected", "edited", "submitted"]);
    expect(activity[0]).toMatchObject({ amount: "9000", detail: "Fine this once.", actorName: "Priya Raman" });
    expect(activity[2]).toMatchObject({ detail: "Use the site van for supplier runs." });
    expect(activity[3]).toMatchObject({ detail: "description" });

    const res = await call("PUT", `/expenses/${expense.id}`, { description: "Too late" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Only a waiting or rejected expense can be edited — an approved expense has already posted to the ledger.");
  });

  it("US-PUR-44: my own expense with the same amount on the same day is found; not a rejected one or another day", async () => {
    const first = await json<{ id: string }>(await call("POST", "/expenses", { categoryId, date: "2026-10-11", currency: "USD", amount: "4850", taxAmount: "0", paidBy: "employee" }));
    await json(await call("POST", "/expenses", { categoryId, date: "2026-10-10", currency: "USD", amount: "4850", taxAmount: "0", paidBy: "employee" }));
    const dupes = await json<PossibleDuplicateExpense[]>(await call("GET", "/expenses/possible-duplicates?amount=4850&date=2026-10-11"));
    expect(dupes.map((d) => d.id)).toEqual([first.id]);
    expect(dupes[0]).toMatchObject({ amount: "4850", currency: "USD", status: "submitted" });
    expect(await json(await call("GET", `/expenses/possible-duplicates?amount=4850&date=2026-10-11&excludeId=${first.id}`))).toEqual([]);
    await json(await call("POST", `/expenses/${first.id}/reject`, { comment: "Duplicate" }));
    expect(await json(await call("GET", "/expenses/possible-duplicates?amount=4850&date=2026-10-11"))).toEqual([]);
  });
});
