import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Bill = { id: string; billNumber: string; contactId: string; bucket: string; balanceDue: string; daysOverdue: number; dueDate: string | null; date: string; paidAmount: string; jobId: string | null; jobName: string | null };
type Vendor = { contactId: string; name: string; billCount: number; overdueAmount: string; totalOutstanding: string; oldestDaysOverdue: number; oldestDueDate: string | null; credit: string; lastPaidOn: string | null };
type Report = { totalOutstanding: string; bills: Bill[]; vendors: Vendor[]; dueSoon: { amount: string; count: number }; drafts: { count: number; amount: string } };

function isoDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-PUR-56, US-PUR-57, US-PUR-59, US-PUR-60 (D-230) — the payables
 * report adds up each vendor (with their open vendor credit and when we
 * last paid them), says more about each bill, counts what's due in 7 days
 * and the drafts it leaves out, and it and its export follow the list's
 * age. Requires local Postgres.
 */
describe("US-PUR-56 to US-PUR-60 · payables you can pay from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let owner: { cookie: string };
  const ids: Record<string, string> = {};
  let creditTotal = "";

  const send = (who: { cookie: string }, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie: who.cookie, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const call = async <T>(who: { cookie: string }, method: string, path: string, body?: unknown): Promise<T> => {
    const res = await send(who, method, path, body);
    if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return (res.headers.get("content-type")?.includes("json") ? res.json() : res.text()) as Promise<T>;
  };
  const bill = async (contactId: string, billNumber: string, amount: string, dueDays: number | null, extra: { jobId?: string; record?: boolean } = {}) => {
    const draft = await call<{ id: string }>(owner, "POST", "/vendor-bills", {
      contactId,
      billNumber,
      date: isoDays(-50),
      ...(dueDays === null ? {} : { dueDate: isoDays(dueDays) }),
      ...(extra.jobId ? { jobId: extra.jobId } : {}),
      currency: "USD",
      lines: [{ type: "item", name: "Materials", quantity: 1, unitPriceAmount: amount }],
    });
    if (extra.record !== false) await call(owner, "POST", `/vendor-bills/${draft.id}/record`);
    return draft.id;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-56-${randomUUID()}@example.com`;
    emails.push(email);
    owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });

    const customer = await call<{ id: string }>(owner, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks" });
    const job = await call<{ id: string }>(owner, "POST", "/jobs", { contactId: customer.id, name: "Wing C fit-out", currency: "USD" });
    ids.job = job.id;
    const apex = await call<{ id: string }>(owner, "POST", "/contacts", { type: "vendor", name: "Apex Building Materials" });
    const coastline = await call<{ id: string }>(owner, "POST", "/contacts", { type: "vendor", name: "Coastline Steel Works" });
    const kaveri = await call<{ id: string }>(owner, "POST", "/contacts", { type: "vendor", name: "Kaveri Sand" });
    ids.apex = apex.id;
    ids.coastline = coastline.id;
    ids.kaveri = kaveri.id;
    ids.late = await bill(apex.id, "ABM-20587", "100000", -40, { jobId: job.id });
    ids.soon = await bill(apex.id, "ABM-20611", "50000", 5);
    ids.coastlineLate = await bill(coastline.id, "CSW-4471", "30000", -10);
    ids.noDue = await bill(kaveri.id, "KSE-124", "12000", null);
    // A draft isn't counted.
    await bill(coastline.id, "CSW-4502", "18400", 20, { record: false });
    // 200.00 paid on the bill due in 5 days.
    await call(owner, "POST", "/vendor-payments", { contactId: apex.id, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: "20000", allocations: [{ billId: ids.soon, amount: "20000" }] });
    // Coastline has open credit.
    const credit = await call<{ id: string }>(owner, "POST", "/vendor-credits", { contactId: coastline.id, vendorReference: "CN-88", date: isoDays(-2), currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "9440" }] });
    creditTotal = (await call<{ balanceAmount: string }>(owner, "POST", `/vendor-credits/${credit.id}/record`)).balanceAmount;
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PUR-56: each vendor we owe, most overdue money first, with their credit and when we last paid them", async () => {
    const report = await call<Report>(owner, "GET", "/reports/payables");
    expect(report.vendors.map((v) => v.name)).toEqual(["Apex Building Materials", "Coastline Steel Works", "Kaveri Sand"]);
    const [apex, coastline, kaveri] = report.vendors;
    expect(apex).toMatchObject({ contactId: ids.apex, billCount: 2, overdueAmount: "100000", totalOutstanding: "130000", oldestDaysOverdue: 40, oldestDueDate: isoDays(-40), credit: "0", lastPaidOn: isoDays(0) });
    expect(coastline).toMatchObject({ billCount: 1, overdueAmount: "30000", totalOutstanding: "30000", credit: creditTotal, lastPaidOn: null });
    expect(BigInt(creditTotal)).toBeGreaterThan(0n);
    // No due date on any bill: nothing is late.
    expect(kaveri).toMatchObject({ billCount: 1, overdueAmount: "0", oldestDueDate: null, oldestDaysOverdue: -1 });
    // The vendors add up to the total.
    expect(report.vendors.reduce((s, v) => s + BigInt(v.totalOutstanding), 0n).toString()).toBe(report.totalOutstanding);
  });

  it("US-PUR-57: each bill has its date, what's been paid and its job", async () => {
    const report = await call<Report>(owner, "GET", "/reports/payables");
    const byId = new Map(report.bills.map((b) => [b.id, b]));
    expect(byId.get(ids.late!)).toMatchObject({ date: isoDays(-50), paidAmount: "0", jobId: ids.job, jobName: "Wing C fit-out", bucket: "31-60" });
    expect(byId.get(ids.soon!)).toMatchObject({ paidAmount: "20000", balanceDue: "30000", jobId: null, jobName: null });
    // Most days late first.
    expect(report.bills[0]!.id).toBe(ids.late);
  });

  it("US-PUR-59: due in 7 days, and the age narrows the report and the export; an unknown age is refused", async () => {
    const report = await call<Report>(owner, "GET", "/reports/payables");
    // Not yet overdue and due within a week; a bill with no due date never is.
    expect(report.dueSoon).toEqual({ amount: "30000", count: 1 });

    const due7 = await call<Report>(owner, "GET", "/reports/payables?age=due7");
    expect(due7.bills.map((b) => b.id)).toEqual([ids.soon]);
    // The totals keep every age.
    expect(due7.totalOutstanding).toBe(report.totalOutstanding);
    const overdue = await call<Report>(owner, "GET", "/reports/payables?age=overdue");
    expect(overdue.bills.map((b) => b.id).sort()).toEqual([ids.late, ids.coastlineLate].sort());

    const lines = async (q: string) => (await call<string>(owner, "GET", `/reports/payables/export.csv${q}`)).split("\r\n").slice(1);
    expect(await lines("?age=due7")).toEqual([expect.stringMatching(/^ABM-20611,Apex Building Materials,USD,/)]);
    expect(await lines("?age=31-60")).toEqual([expect.stringMatching(/^ABM-20587,/)]);
    // The search matches the job too.
    expect(await lines("?search=wing%20c")).toEqual([expect.stringMatching(/^ABM-20587,/)]);

    for (const path of ["/reports/payables?age=soon", "/reports/payables/export.csv?age=soon"]) {
      const res = await send(owner, "GET", path);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("Choose an age to show.");
    }
  });

  it("US-PUR-60: the draft bills it doesn't count", async () => {
    const report = await call<Report>(owner, "GET", "/reports/payables");
    expect(report.drafts).toEqual({ count: 1, amount: "18400" });
  });
});
