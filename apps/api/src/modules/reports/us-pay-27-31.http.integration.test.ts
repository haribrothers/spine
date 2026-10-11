import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Row = { id: string; number: string; contactId: string; bucket: string; balanceDue: string; daysOverdue: number; issueDate: string | null; type: string; paidAmount: string; jobId: string | null; jobName: string | null; lastReminderOn: string | null; remindedToday: boolean; contactHasEmail: boolean };
type Customer = { contactId: string; name: string; email: string | null; invoiceCount: number; overdueAmount: string; totalOutstanding: string; oldestDaysOverdue: number; credit: string; lastReminderOn: string | null };
type Report = { totalOutstanding: string; buckets: Record<string, string>; invoices: Row[]; customers: Customer[]; retention: { held: string; jobCount: number } };

function isoDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-PAY-27, US-PAY-29, US-PAY-30, US-PAY-31 (D-224) — the receivables
 * report adds up each customer (with their credit and last reminder), says
 * more about each invoice, carries the retention held on jobs, and its
 * export follows the list's age. Requires local Postgres.
 */
describe("US-PAY-27 to US-PAY-31 · receivables you can chase from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let owner: { cookie: string };
  let demo: { cookie: string };
  const ids: Record<string, string> = {} as Record<string, string>;

  const call = async <T>(who: { cookie: string }, method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie: who.cookie, "Content-Type": "application/json", ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    return (res.headers.get("content-type")?.includes("json") ? res.json() : res.text()) as Promise<T>;
  };
  const invoice = async (contactId: string, amount: string, dueDays: number) => {
    const draft = await call<{ id: string }>(owner, "POST", "/invoices", { contactId, currency: "USD", dueDate: isoDays(dueDays), lines: [{ type: "item", name: "Site work", quantity: 1, unitPriceAmount: amount }] });
    return call<{ id: string; number: string }>(owner, "POST", `/invoices/${draft.id}/issue`, {});
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const a = `us-pay-27-${randomUUID()}@example.com`;
    const b = `us-pay-27-demo-${randomUUID()}@example.com`;
    emails.push(a, b);
    owner = await signUp(testApp.baseUrl, { email: a, password: "testpassword123", name: "Owner" });
    demo = await signUp(testApp.baseUrl, { email: b, password: "testpassword123", name: "Owner" });
    await call(demo, "POST", "/demo-data/seed");

    const halcyon = await call<{ id: string }>(owner, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks", email: `accounts-${randomUUID()}@halcyon.example` });
    const karthik = await call<{ id: string }>(owner, "POST", "/contacts", { type: "customer", name: "Karthik Subramanian" });
    ids.halcyon = halcyon.id;
    ids.karthik = karthik.id;
    ids.late = (await invoice(halcyon.id, "100000", -40)).id;
    ids.soon = (await invoice(halcyon.id, "50000", 5)).id;
    ids.karthikLate = (await invoice(karthik.id, "30000", -10)).id;
    // 100.00 of a 300.00 payment goes on the invoice not yet due; 200.00 stays as Halcyon's credit.
    await call(owner, "POST", "/payments", { contactId: halcyon.id, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: "30000", allocations: [{ invoiceId: ids.soon, amount: "10000" }], sendReceipt: false });
    await call(owner, "POST", `/invoices/${ids.late}/send-reminder`, {});
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PAY-27: each customer who owes, most overdue money first, with their credit and last reminder", async () => {
    const report = await call<Report>(owner, "GET", "/reports/receivables");
    const today = orgClock().date;
    expect(report.customers.map((c) => c.name)).toEqual(["Halcyon Tech Parks", "Karthik Subramanian"]);
    const [halcyon, karthik] = report.customers;
    expect(halcyon).toMatchObject({ contactId: ids.halcyon, invoiceCount: 2, overdueAmount: "100000", totalOutstanding: "140000", oldestDaysOverdue: 40, credit: "20000", lastReminderOn: today });
    expect(halcyon!.email).toMatch(/@halcyon\.example$/);
    expect(karthik).toMatchObject({ invoiceCount: 1, overdueAmount: "30000", totalOutstanding: "30000", oldestDaysOverdue: 10, credit: "0", lastReminderOn: null, email: null });
    // The customers add up to the same totals as the ages.
    const sum = report.customers.reduce((s, c) => s + BigInt(c.totalOutstanding), 0n);
    expect(sum.toString()).toBe(report.totalOutstanding);
  });

  it("US-PAY-30: each invoice says its issue date, what's been paid, its last reminder and whether the customer has an email", async () => {
    const report = await call<Report>(owner, "GET", "/reports/receivables");
    const byId = new Map<string | undefined, Row>(report.invoices.map((i) => [i.id, i]));
    expect(byId.get(ids.late)).toMatchObject({ remindedToday: true, contactHasEmail: true, paidAmount: "0", type: "standard", jobId: null, jobName: null });
    expect(byId.get(ids.late)!.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(byId.get(ids.soon)).toMatchObject({ paidAmount: "10000", balanceDue: "40000", lastReminderOn: null, remindedToday: false });
    expect(byId.get(ids.karthikLate)).toMatchObject({ contactHasEmail: false });
  });

  it("US-PAY-27, US-PAY-31: on the demo, customers add up to the aging, the job is named and retention matches the dashboard", async () => {
    const report = await call<Report>(demo, "GET", "/reports/receivables");
    expect(report.customers.length).toBeGreaterThan(0);
    const overdue = report.customers.reduce((s, c) => s + BigInt(c.overdueAmount), 0n);
    expect(overdue.toString()).toBe((BigInt(report.totalOutstanding) - BigInt(report.buckets.current!)).toString());
    for (const row of report.invoices.filter((i) => i.jobId)) expect(row.jobName).toBeTruthy();
    const dashboard = await call<{ total: string; jobCount: number }>(demo, "GET", "/dashboard/retention");
    expect(report.retention).toEqual({ held: dashboard.total, jobCount: dashboard.jobCount });
  });

  it("US-PAY-29: the export follows the list's age; an unknown age keeps every row", async () => {
    const lines = async (q: string) => (await call<string>(owner, "GET", `/reports/receivables/export.csv${q}`)).split("\r\n").slice(1);
    expect(await lines("")).toHaveLength(3);
    expect(await lines("?age=overdue")).toHaveLength(2);
    expect((await lines("?age=current")).length).toBe(1);
    expect(await lines("?age=31-60")).toHaveLength(1);
    expect(await lines("?age=0-30")).toHaveLength(1);
    expect(await lines("?age=90%2B")).toHaveLength(0);
    expect(await lines("?age=sometime")).toHaveLength(3);
    expect(await lines("?age=overdue&search=karthik")).toHaveLength(1);
    // The report itself (what Excel and PDF are built from) narrows the invoices; the totals keep every age.
    const all = await call<Report>(owner, "GET", "/reports/receivables");
    const overdue = await call<Report>(owner, "GET", "/reports/receivables?age=overdue");
    expect(overdue.invoices).toHaveLength(2);
    expect(overdue.buckets).toEqual(all.buckets);
  });
});
