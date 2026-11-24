import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, createPaymentSchema, type Kpi } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, expenseCategories, expenses, invoices, member, session as sessionTable, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { ExpensesService } from "../purchases/expenses.service";
import { QueueService } from "../queue/queue.service";
import { monthEarlier } from "./kpi.service";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-DASH-14 (D-089) — `GET /dashboard/kpis`: cash, profit this month,
 * receivables and overdue from the ledger, each with 8 weekly points and
 * last month's figure (or none). Requires local Postgres.
 */
describe("US-DASH-14 · see key figures with a trend and a comparison (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let cookie: string;
  let fieldCookie: string;
  const today = orgClock().date;

  const kpis = async (who: string) => (await (await fetch(`${testApp.baseUrl}/dashboard/kpis`, { headers: { cookie: who } })).json()) as Kpi[];

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-dash-14-${randomUUID()}@example.com`;
    emails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();

    // Cash: 1,000.00 received well before a month ago, 200.00 today.
    const paymentsService = testApp.app.get(PaymentsService);
    await paymentsService.create(orgId, owner.userId, createPaymentSchema.parse({ contactId: contact!.id, date: addDays(monthEarlier(today), -5), method: "bank_transfer", currency: "USD", amount: "100000" }));
    await paymentsService.create(orgId, owner.userId, createPaymentSchema.parse({ contactId: contact!.id, date: today, method: "bank_transfer", currency: "USD", amount: "20000" }));

    // Receivables and overdue: a 500.00 invoice, due yesterday.
    const invoicesService = testApp.app.get(InvoicesService);
    const draft = await invoicesService.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "USD", lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "50000" }] }));
    const issued = await invoicesService.issue(orgId, draft.id, owner.userId);
    await db.update(invoices).set({ dueDate: new Date(`${addDays(today, -1)}T00:00:00Z`) }).where(eq(invoices.id, issued.id));

    // Profit: less a 100.00 expense.
    const [materials] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5000")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Materials", accountId: materials!.id }).returning();
    const [expense] = await db.insert(expenses).values({ orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 10000n, submittedByUserId: owner.userId }).returning();
    await testApp.app.get(ExpensesService).approve(orgId, expense!.id, owner.userId, null);

    const fieldEmail = `us-dash-14-field-${randomUUID()}@example.com`;
    emails.push(fieldEmail);
    const field = await signUp(testApp.baseUrl, { email: fieldEmail, password: "testpassword123", name: "Field" });
    fieldCookie = field.cookie;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("an Owner gets cash position, profit this month, receivables and overdue, each with 8 weekly points", async () => {
    const rows = await kpis(cookie);
    expect(rows.map((k) => [k.key, k.label])).toEqual([
      ["cash", "Cash position"],
      ["profit", "Profit this month"],
      ["receivables", "Receivables"],
      ["overdue", "Overdue"],
      // US-DASH-21 — its own card, not part of the KPI row.
      ["payables", "Payables"],
    ]);
    for (const k of rows) expect(k.series).toHaveLength(8);
    const [cash, profit, receivables, overdue] = rows;
    expect(cash).toMatchObject({ value: "110000", previous: "100000" });
    expect(cash!.series.at(-1)).toBe("110000");
    expect(profit).toMatchObject({ value: "40000" });
    expect(receivables).toMatchObject({ value: "50000", previous: null, detail: { current: "0", overdue: "50000" } });
    expect(overdue).toMatchObject({ value: "50000", previous: null, detail: { count: 1 } });
  });

  it("Field users get none", async () => {
    expect(await kpis(fieldCookie)).toEqual([]);
  });

  it("a month earlier keeps the day, or the month's last day", () => {
    expect(monthEarlier("2026-10-05")).toBe("2026-09-05");
    expect(monthEarlier("2026-03-31")).toBe("2026-02-28");
    expect(monthEarlier("2026-01-15")).toBe("2025-12-15");
  });
});
