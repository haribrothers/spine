import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceLines, invoices, member, notifications, recurringInvoices, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { INVOICE_SEND_EMAIL_QUEUE } from "./invoice-email.worker";
import { RecurringInvoiceRunService } from "./recurring-invoice-run.service";

/** 7:00 AM on `date` in organisation time (the test pins TZ to UTC). */
const at = (date: string, time = "07:00") => new Date(`${date}T${time}:00Z`);

/**
 * US-INV-21 (D-092) — the 6:00 AM run: one invoice per schedule per due
 * date, issued and emailed or left as a draft with an Owner notification,
 * never twice, catching up a missed run once, and finishing at the end.
 * Requires local Postgres.
 */
describe("US-INV-21 · create recurring invoices automatically (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-21-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let ownerId: string;
  let contactId: string;
  let run: RecurringInvoiceRunService;
  let queued: ReturnType<typeof vi.fn>;
  const tz = process.env.TZ;

  async function schedule(overrides: Record<string, unknown>, nextRunOn: string) {
    const res = await fetch(`${testApp.baseUrl}/recurring-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({
        name: `Monthly maintenance ${randomUUID().slice(0, 4)}`,
        contactId,
        currency: "USD",
        frequency: "monthly",
        dayRule: "1",
        startsOn: orgClock().date,
        dueDays: 14,
        mode: "issue_and_email",
        lines: [
          { type: "heading", name: "Hotel lobby" },
          { type: "item", name: "Monthly maintenance visit", quantity: 1, unitPriceAmount: "125000", taxRatePercentage: 10 },
        ],
        ...overrides,
      }),
    });
    expect(res.status).toBeLessThan(300);
    const saved = (await res.json()) as { id: string; name: string };
    await db.update(recurringInvoices).set({ nextRunOn }).where(eq(recurringInvoices.id, saved.id));
    return saved;
  }
  const made = (scheduleId: string) => db.select().from(invoices).where(eq(invoices.recurringInvoiceId, scheduleId));
  const reload = async (scheduleId: string) => (await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, scheduleId)))[0]!;

  beforeAll(async () => {
    process.env.TZ = "UTC";
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    ownerId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, ownerId)))[0]!.organizationId;
    const [contact] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Bluewater Hospitality Group", email: `ap-${randomUUID()}@example.com`, createdByUserId: ownerId })
      .returning();
    contactId = contact!.id;
    run = testApp.app.get(RecurringInvoiceRunService);
  }, 120_000);

  beforeEach(() => {
    queued = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(queued);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    process.env.TZ = tz;
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("'Issue and email': one invoice from the lines, issued with a number, posted, emailed, and the next date advances", async () => {
    const s = await schedule({}, "2026-12-01");
    await run.runDue(at("2026-12-01"));
    const [invoice, ...extra] = await made(s.id);
    expect(extra).toHaveLength(0);
    expect(invoice).toMatchObject({ status: "issued", contactId, recurringRunOn: "2026-12-01", totalAmount: 137500n, taxAmount: 12500n });
    expect(invoice!.number).toMatch(/^INV-\d+$/);
    expect(invoice!.journalEntryId).not.toBeNull();
    expect(invoice!.dueDate!.toISOString().slice(0, 10)).toBe("2026-12-15");
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice!.id)).orderBy(invoiceLines.sortOrder);
    expect(lines.map((l) => [l.type, l.name])).toEqual([
      ["heading", "Hotel lobby"],
      ["item", "Monthly maintenance visit"],
    ]);
    expect(queued.mock.calls.filter(([q, d]) => q === INVOICE_SEND_EMAIL_QUEUE && (d as { invoiceId: string }).invoiceId === invoice!.id)).toHaveLength(1);
    expect(await reload(s.id)).toMatchObject({ status: "active", nextRunOn: "2027-01-01", createdCount: 1 });
  });

  it("'Create a draft': a draft invoice, and Owners get 'Recurring invoice ready to review: <name>'", async () => {
    const s = await schedule({ mode: "draft" }, "2026-12-01");
    await run.runDue(at("2026-12-01"));
    const [invoice] = await made(s.id);
    expect(invoice).toMatchObject({ status: "draft", number: null });
    await vi.waitFor(async () => {
      const rows = await db.select().from(notifications).where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, ownerId)));
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ type: "recurring_invoice_draft", message: `Recurring invoice ready to review: ${s.name}`, link: `/invoices/${invoice!.id}` })]));
    });
  });

  it("nothing runs before 6:00 AM, and a late, repeated or racing run makes no second invoice for a date", async () => {
    const s = await schedule({}, "2026-12-01");
    await run.runDue(at("2026-12-01", "05:59"));
    expect(await made(s.id)).toHaveLength(0);

    await run.runDue(at("2026-12-01"));
    await run.runDue(at("2026-12-01", "07:15"));
    expect(await made(s.id)).toHaveLength(1);

    // A second run that still saw the old next date (a race) hits the unique (schedule, date) and only moves the schedule on.
    await db.update(recurringInvoices).set({ nextRunOn: "2026-12-01" }).where(eq(recurringInvoices.id, s.id));
    await run.runSchedule(await reload(s.id), "2026-12-01");
    expect(await made(s.id)).toHaveLength(1);
    expect(await reload(s.id)).toMatchObject({ nextRunOn: "2027-01-01", createdCount: 1 });
  });

  it("a run missed while the server was off catches up once, then moves past today", async () => {
    const s = await schedule({}, "2026-10-01");
    await run.runDue(at("2026-12-15"));
    const created = await made(s.id);
    expect(created.map((i) => i.recurringRunOn)).toEqual(["2026-10-01"]);
    expect(await reload(s.id)).toMatchObject({ nextRunOn: "2027-01-01", createdCount: 1 });
  });

  it("when the end condition is reached, the schedule shows Finished", async () => {
    const byCount = await schedule({ maxCount: 1 }, "2026-12-01");
    const byDate = await schedule({ endsOn: "2026-12-31" }, "2026-12-01");
    await run.runDue(at("2026-12-01"));
    expect(await reload(byCount.id)).toMatchObject({ status: "finished", nextRunOn: null, createdCount: 1 });
    expect(await reload(byDate.id)).toMatchObject({ status: "finished", nextRunOn: null, createdCount: 1 });
    const list = (await (await fetch(`${testApp.baseUrl}/recurring-invoices`, { headers: { cookie } })).json()) as { id: string; status: string }[];
    expect(list.find((r) => r.id === byCount.id)?.status).toBe("finished");
  });
});
