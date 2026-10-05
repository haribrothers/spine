import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, type InvoiceReminders } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceReminders, invoices, member, settings, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { QueueService } from "../queue/queue.service";
import { InvoiceEmailWorker, INVOICE_SEND_EMAIL_QUEUE } from "./invoice-email.worker";
import { InvoiceRemindersService } from "./invoice-reminders.service";
import { InvoicesService } from "./invoices.service";

const TODAY = "2026-10-05";
const CONFIG: InvoiceReminders = { enabled: true, offsets: [-3, 0, 7, 14], repeatEvery: null, repeatMax: null, sendAt: "09:00" };

/** `YYYY-MM-DD`, `days` before `date`. */
function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-INV-19 — the daily reminder run: sends on the scheduled days, never
 * twice a day (automatic or manual), skips paid/voided invoices and paused
 * contacts, runs a day once, and records "Automatic reminder sent".
 * Requires local Postgres.
 */
describe("US-INV-19 · send reminders on schedule without double-sending (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-19-${randomUUID()}@example.com`;
  let cookie: string;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let invoicesService: InvoicesService;
  let reminders: InvoiceRemindersService;
  let queued: ReturnType<typeof vi.fn>;

  async function issuedInvoice(dueDate: string, forContact = contactId) {
    const draft = await invoicesService.create(
      orgId,
      userId,
      createInvoiceSchema.parse({ contactId: forContact, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "220000", taxRatePercentage: 0 }] }),
    );
    const issued = await invoicesService.issue(orgId, draft.id, userId);
    await db.update(invoices).set({ dueDate: new Date(`${dueDate}T00:00:00Z`) }).where(eq(invoices.id, issued.id));
    return issued.id;
  }

  const remindedOn = (invoiceId: string) => db.select().from(invoiceReminders).where(eq(invoiceReminders.invoiceId, invoiceId));
  const reminderJobs = (invoiceId: string) => queued.mock.calls.filter(([queue, data]) => queue === INVOICE_SEND_EMAIL_QUEUE && (data as { invoiceId: string }).invoiceId === invoiceId);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Alan Brooks", email: `alan-${randomUUID()}@example.com`, createdByUserId: userId })
      .returning();
    contactId = contact!.id;
    invoicesService = testApp.app.get(InvoicesService);
    reminders = testApp.app.get(InvoiceRemindersService);
  }, 120_000);

  beforeEach(() => {
    queued = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(queued);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("an issued invoice with a balance on a scheduled day gets one reminder, with its days overdue", async () => {
    const overdue = await issuedInvoice(daysBefore(TODAY, 7));
    const dueSoon = await issuedInvoice(daysBefore(TODAY, -3));
    const offSchedule = await issuedInvoice(daysBefore(TODAY, 5));
    const { sent } = await reminders.runForOrg(orgId, TODAY, CONFIG);
    expect(sent).toEqual(expect.arrayContaining([overdue, dueSoon]));
    expect(sent).not.toContain(offSchedule);
    expect(reminderJobs(overdue)).toEqual([[INVOICE_SEND_EMAIL_QUEUE, { orgId, invoiceId: overdue, isReminder: true, daysOverdue: 7 }]]);
    expect(reminderJobs(dueSoon)[0]![1]).toMatchObject({ daysOverdue: -3 });
    expect(await remindedOn(overdue)).toEqual([expect.objectContaining({ sentOn: TODAY, kind: "auto" })]);
  });

  it("repeats every 14 days after the last offset, up to the limit", async () => {
    const thirdRepeat = await issuedInvoice(daysBefore(TODAY, 14 + 3 * 14));
    const pastLimit = await issuedInvoice(daysBefore(TODAY, 14 + 4 * 14));
    const { sent } = await reminders.runForOrg(orgId, TODAY, { ...CONFIG, repeatEvery: 14, repeatMax: 3 });
    expect(sent).toContain(thirdRepeat);
    expect(sent).not.toContain(pastLimit);
  });

  it("an invoice already reminded today — automatically or by hand — gets no second reminder", async () => {
    const auto = await issuedInvoice(daysBefore(TODAY, 14));
    expect((await reminders.runForOrg(orgId, TODAY, CONFIG)).sent).toContain(auto);
    expect((await reminders.runForOrg(orgId, TODAY, CONFIG)).sent).not.toContain(auto);
    expect(reminderJobs(auto)).toHaveLength(1);

    // A manual reminder counts as today's (in organisation time).
    const today = orgClock().date;
    const manual = await issuedInvoice(daysBefore(today, 7));
    await invoicesService.sendReminder(orgId, manual, userId);
    expect(await remindedOn(manual)).toEqual([expect.objectContaining({ sentOn: today, kind: "manual" })]);
    expect((await reminders.runForOrg(orgId, today, CONFIG)).sent).not.toContain(manual);
    expect(reminderJobs(manual)).toHaveLength(1); // the manual one only
  });

  it("paid, voided and fully credited invoices get nothing", async () => {
    const paid = await issuedInvoice(daysBefore(TODAY, 7));
    await db.update(invoices).set({ amountPaid: 220000n }).where(eq(invoices.id, paid));
    const credited = await issuedInvoice(daysBefore(TODAY, 7));
    await db.update(invoices).set({ creditedAmount: 220000n }).where(eq(invoices.id, credited));
    const voided = await issuedInvoice(daysBefore(TODAY, 7));
    await invoicesService.void(orgId, voided, userId, "Raised in error");
    const { sent } = await reminders.runForOrg(orgId, TODAY, CONFIG);
    expect(sent).not.toContain(paid);
    expect(sent).not.toContain(credited);
    expect(sent).not.toContain(voided);
  });

  it("a contact with 'Pause automatic reminders' on is skipped", async () => {
    const [paused] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Northgate Dental", email: `northgate-${randomUUID()}@example.com`, createdByUserId: userId })
      .returning();
    const res = await fetch(`${testApp.baseUrl}/contacts/${paused!.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ remindersPaused: true }),
    });
    expect(res.status).toBeLessThan(300);
    expect(((await res.json()) as { remindersPaused: boolean }).remindersPaused).toBe(true);
    const invoice = await issuedInvoice(daysBefore(TODAY, 7), paused!.id);
    expect((await reminders.runForOrg(orgId, TODAY, CONFIG)).sent).not.toContain(invoice);
  });

  it("runs a day once after 'Send at', however often the job fires — missed days aren't repeated", async () => {
    const now = new Date();
    const today = orgClock(now).date;
    await db
      .insert(settings)
      .values({ orgId, key: "invoice_reminders", value: { ...CONFIG, sendAt: "00:00" } })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { ...CONFIG, sendAt: "00:00" } } });
    await db.delete(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "invoice_reminders_last_run")));
    const invoice = await issuedInvoice(daysBefore(today, 0));

    await reminders.runDue(now);
    expect(reminderJobs(invoice)).toHaveLength(1);
    const [lastRun] = await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "invoice_reminders_last_run")));
    expect(lastRun!.value).toEqual({ date: today });

    // Even with today's record gone, the day doesn't run a second time.
    await db.delete(invoiceReminders).where(eq(invoiceReminders.invoiceId, invoice));
    await reminders.runDue(now);
    expect(reminderJobs(invoice)).toHaveLength(1);

    // Before "Send at", nothing runs.
    await db.update(settings).set({ value: { ...CONFIG, sendAt: "23:59" } }).where(and(eq(settings.orgId, orgId), eq(settings.key, "invoice_reminders")));
    await db.delete(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "invoice_reminders_last_run")));
    if (orgClock(now).time < "23:59") {
      await reminders.runDue(now);
      expect(reminderJobs(invoice)).toHaveLength(1);
    }
  });

  it("the invoice history shows 'Automatic reminder sent'", async () => {
    const invoice = await issuedInvoice(daysBefore(TODAY, 0));
    await reminders.runForOrg(orgId, TODAY, CONFIG);
    const history = (await (await fetch(`${testApp.baseUrl}/invoices/${invoice}/history`, { headers: { cookie } })).json()) as { action: string; actorUserId: string | null }[];
    expect(history).toEqual(expect.arrayContaining([expect.objectContaining({ action: "automatic_reminder_sent", actorUserId: null })]));
  });

  it("the reminder email reads 'Reminder: invoice <number> is <n> days overdue' and shows the balance and payment instructions", async () => {
    await db
      .insert(settings)
      .values({ orgId, key: "business_profile", value: { name: "Riverstone Builders", paymentInstructions: "Bank transfer to Riverstone Builders LLC" } })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { name: "Riverstone Builders", paymentInstructions: "Bank transfer to Riverstone Builders LLC" } } });
    const invoice = await issuedInvoice(daysBefore(TODAY, 7));
    const [row] = await db.select().from(invoices).where(eq(invoices.id, invoice));
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const send = vi.spyOn(emailService, "send").mockResolvedValue();
    const worker = testApp.app.get(InvoiceEmailWorker);

    await worker.process({ orgId, invoiceId: invoice, isReminder: true, daysOverdue: 7 });
    await worker.process({ orgId, invoiceId: invoice, isReminder: true, daysOverdue: 0 });
    await worker.process({ orgId, invoiceId: invoice, isReminder: true, daysOverdue: -3 });
    // Only this invoice's emails: queue workers in this app may send others meanwhile.
    const mine = send.mock.calls.map(([m]) => m).filter((m) => m.subject?.includes(row!.number!));
    expect(mine.map((m) => m.subject)).toEqual([
      `Reminder: invoice ${row!.number} is 7 days overdue`,
      `Reminder: invoice ${row!.number} is due today`,
      `Reminder: invoice ${row!.number} is due in 3 days`,
    ]);
    const html = mine[0]!.html!;
    expect(html).toContain("Balance due");
    expect(html).toContain("$2,200.00");
    expect(html).toContain("Bank transfer to Riverstone Builders LLC");
  });
});
