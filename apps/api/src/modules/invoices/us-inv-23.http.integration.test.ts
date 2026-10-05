import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceReminders, invoices, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { QueueService } from "../queue/queue.service";
import { INVOICE_SEND_EMAIL_QUEUE } from "./invoice-email.worker";
import { InvoicesService } from "./invoices.service";

/**
 * US-INV-23 (D-097) — `POST /invoices/bulk/send-reminders`: reminds the
 * eligible invoices, reports the rest with reasons, caps at 100 and needs
 * `invoices.send_reminder`. Requires local Postgres.
 */
describe("US-INV-23 · send reminders for several invoices at once (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-23-${randomUUID()}@example.com`;
  const staffEmail = `us-inv-23-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let noEmailContactId: string;
  let invoicesService: InvoicesService;
  let queued: ReturnType<typeof vi.fn>;

  const bulk = (ids: string[], who = cookie) =>
    fetch(`${testApp.baseUrl}/invoices/bulk/send-reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: JSON.stringify({ ids }),
    });

  async function invoice(opts: { issue?: boolean; contact?: string; dueInDays?: number } = {}) {
    const draft = await invoicesService.create(
      orgId,
      userId,
      createInvoiceSchema.parse({ contactId: opts.contact ?? contactId, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "220000" }] }),
    );
    if (opts.issue === false) return draft.id;
    const issued = await invoicesService.issue(orgId, draft.id, userId);
    const due = new Date(`${orgClock().date}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + (opts.dueInDays ?? -10));
    await db.update(invoices).set({ dueDate: due }).where(eq(invoices.id, issued.id));
    return issued.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", email: `ap-${randomUUID()}@example.com`, createdByUserId: userId }).returning();
    contactId = contact!.id;
    const [noEmail] = await db.insert(contacts).values({ orgId, type: "customer", name: "Priya Nair", createdByUserId: userId }).returning();
    noEmailContactId = noEmail!.id;
    invoicesService = testApp.app.get(InvoicesService);

    // Staff whose Team can't send reminders.
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `No reminders ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "invoices.send_reminder", granted: false });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  beforeEach(() => {
    queued = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(queued);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  it("reminds the eligible invoices and reports every skipped one with the reason", async () => {
    const overdue = await invoice();
    const dueSoon = await invoice({ dueInDays: 3 });
    const draft = await invoice({ issue: false });
    const paid = await invoice();
    await db.update(invoices).set({ amountPaid: 220000n }).where(eq(invoices.id, paid));
    const voided = await invoice();
    await invoicesService.void(orgId, voided, userId, "Raised in error");
    const remindedToday = await invoice();
    await invoicesService.sendReminder(orgId, remindedToday, userId);
    const noEmail = await invoice({ contact: noEmailContactId });
    const missing = randomUUID();
    queued.mockClear();

    const res = await bulk([overdue, dueSoon, draft, paid, voided, remindedToday, noEmail, missing]);
    expect(res.status).toBeLessThan(300);
    const body = (await res.json()) as { done: string[]; skipped: { id: string; label: string | null; reason: string }[] };
    expect(body.done).toEqual([overdue, dueSoon]);
    expect(body.skipped.map((s) => [s.id, s.reason])).toEqual([
      [draft, "It's a draft — issue it first."],
      [paid, "Nothing is owed on it."],
      [voided, "It's void."],
      [remindedToday, "Already reminded today."],
      [noEmail, "The customer has no email address."],
      [missing, "Not found."],
    ]);
    expect(body.skipped.find((s) => s.id === paid)?.label).toMatch(/^INV-\d+$/);
    expect(queued.mock.calls.filter(([q]) => q === INVOICE_SEND_EMAIL_QUEUE).map(([, d]) => d)).toEqual([
      { orgId, invoiceId: overdue, isReminder: true, daysOverdue: 10 },
      { orgId, invoiceId: dueSoon, isReminder: true, daysOverdue: -3 },
    ]);
    expect(await db.select().from(invoiceReminders).where(eq(invoiceReminders.invoiceId, overdue))).toEqual([expect.objectContaining({ kind: "manual", sentOn: orgClock().date })]);

    // Sending again the same day reminds nobody twice.
    const again = (await (await bulk([overdue])).json()) as { done: string[]; skipped: { reason: string }[] };
    expect(again).toMatchObject({ done: [], skipped: [{ reason: "Already reminded today." }] });
  });

  it("the list says which invoices were reminded today", async () => {
    const reminded = await invoice();
    await bulk([reminded]);
    const list = (await (await fetch(`${testApp.baseUrl}/invoices`, { headers: { cookie } })).json()) as { id: string; remindedToday: boolean; lastReminderOn: string | null }[];
    expect(list.find((i) => i.id === reminded)).toMatchObject({ remindedToday: true, lastReminderOn: orgClock().date });
  });

  it("accepts at most 100 invoices", async () => {
    const res = await bulk(Array.from({ length: 101 }, () => randomUUID()));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Select 100 or fewer invoices.");
  });

  it("without invoices.send_reminder it's refused", async () => {
    expect((await bulk([await invoice()], staffCookie)).status).toBe(403);
  });
});
