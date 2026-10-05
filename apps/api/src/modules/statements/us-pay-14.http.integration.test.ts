import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, createPaymentSchema, type Statement } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { activities, addresses, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { QueueService } from "../queue/queue.service";

/**
 * US-PAY-14 — a customer's statement: the summary for a period, the PDF,
 * and sending it (logged on their timeline), behind
 * `reports.view_receivables`. Requires local Postgres.
 */
describe("US-PAY-14 · send a customer a statement (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pay-14-${randomUUID()}@example.com`;
  const staffEmail = `us-pay-14-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let emptyContactId: string;
  const customerEmail = `daniel.ortiz-${randomUUID().slice(0, 6)}@mapleridge.example`;
  const numbers: Record<string, string> = {};

  const today = orgClock().date;
  const daysAgo = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const from = daysAgo(29);
  const period = `from=${from}&to=${today}`;
  const get = (path: string, who = cookie) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who } });
  const send = (id: string, data: Record<string, unknown>, who = cookie) =>
    fetch(`${testApp.baseUrl}/contacts/${id}/statement/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: JSON.stringify({ from, to: today, mode: "all", ...data }),
    });

  async function issued(amount: string, label: string) {
    const invoicesService = testApp.app.get(InvoicesService);
    const draft = await invoicesService.create(orgId, userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: label, quantity: 1, unitPriceAmount: amount }] }));
    const invoice = await invoicesService.issue(orgId, draft.id, userId);
    numbers[label] = invoice.number!;
    return invoice;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(undefined);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", email: customerEmail, createdByUserId: userId }).returning();
    contactId = contact!.id;
    await db.insert(addresses).values({ contactId, type: "billing", line1: "220 Ridge Rd", city: "Burlington", state: "VT", postalCode: "05401", isPrimary: true });
    const [empty] = await db.insert(contacts).values({ orgId, type: "customer", name: "Priya Nair", email: "priya@example.com", createdByUserId: userId }).returning();
    emptyContactId = empty!.id;

    // Two invoices, the first paid in full.
    const payments = testApp.app.get(PaymentsService);
    const first = await issued("875000", "First");
    await issued("454250", "Second");
    const payment = await payments.create(
      orgId,
      userId,
      createPaymentSchema.parse({ contactId, date: today, method: "bank_transfer", currency: "USD", amount: "875000", allocations: [{ invoiceId: first.id, amount: "875000" }] }),
    );
    numbers.payment = payment.number!;

    // Staff whose Team can't see receivables.
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `No receivables ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "reports.view_receivables", granted: false });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  it("the summary shows the opening balance, invoiced, paid and credited, and balance due for the period", async () => {
    const res = await get(`/contacts/${contactId}/statement?${period}&mode=all`);
    expect(res.status).toBe(200);
    const s = (await res.json()) as Statement;
    expect(s).toMatchObject({
      contactName: "Maple Ridge Developments",
      contactEmail: customerEmail,
      contactAddress: "220 Ridge Rd, Burlington, VT 05401",
      currency: "USD",
      openingBalance: "0",
      invoiced: "1329250",
      paidAndCredited: "875000",
      balanceDue: "454250",
      hasInvoices: true,
    });
    expect(s.rows).toEqual([
      { date: today, reference: numbers.First, type: "Invoice", charges: "875000", payments: "0", balance: "875000" },
      { date: today, reference: numbers.Second, type: "Invoice", charges: "454250", payments: "0", balance: "1329250" },
      { date: today, reference: numbers.payment, type: "Payment", charges: "0", payments: "875000", balance: "454250" },
    ]);
  });

  it("activity before the period becomes the opening balance", async () => {
    const tomorrow = daysAgo(-1);
    const s = (await (await get(`/contacts/${contactId}/statement?from=${tomorrow}&to=${tomorrow}&mode=all`)).json()) as Statement;
    expect(s).toMatchObject({ openingBalance: "454250", invoiced: "0", paidAndCredited: "0", balanceDue: "454250", rows: [] });
  });

  it("'Download PDF' returns the statement PDF", async () => {
    const res = await get(`/contacts/${contactId}/statement.pdf?${period}&mode=all`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="statement-Maple-Ridge-Developments-${today}.pdf"`);
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("'Send statement' emails the PDF to 'To' and records it on the contact's timeline", async () => {
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const sent = vi.spyOn(emailService, "send").mockResolvedValue();
    const res = await send(contactId, { email: "accounts@mapleridge.example", message: "Hi Daniel, please find your statement attached." });
    expect(res.status).toBeLessThan(300);
    expect(await res.json()).toEqual({ sentTo: "accounts@mapleridge.example" });
    // Queue workers in this app may send other emails meanwhile; find this one by recipient.
    const mail = sent.mock.calls.map(([m]) => m).find((m) => m.to === "accounts@mapleridge.example")!;
    expect(mail.to).toBe("accounts@mapleridge.example");
    expect(mail.subject).toMatch(/^Your statement from .+ \([A-Z][a-z]{2} \d{1,2}(, \d{4})? – [A-Z][a-z]{2} \d{1,2}, \d{4}\)$/);
    expect(mail.html).toContain("Hi Daniel, please find your statement attached.");
    expect(mail.attachments?.find((a) => a.contentType === "application/pdf")?.filename).toBe(`statement-Maple-Ridge-Developments-${today}.pdf`);

    const notes = await db.select().from(activities).where(eq(activities.contactId, contactId));
    expect(notes).toEqual([expect.objectContaining({ type: "note", notes: expect.stringMatching(/^Statement sent to accounts@mapleridge\.example for .+\. Balance due \$4,542\.50\.$/) })]);
    expect(notes[0]!.doneAt).not.toBeNull();
    const history = (await (await get(`/contacts/${contactId}/history`)).json()) as { action: string }[];
    expect(history.map((h) => h.action)).toContain("statement_sent");
  });

  it("without email set up, sending says so instead of failing silently", async () => {
    vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(false);
    const res = await send(contactId, { email: customerEmail });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { message: string }).message).toMatch(/^Email isn't set up yet/);
  });

  it("a customer with no invoices can't be sent one: 'No invoices for this customer yet.'", async () => {
    const s = (await (await get(`/contacts/${emptyContactId}/statement?${period}&mode=all`)).json()) as Statement;
    expect(s.hasInvoices).toBe(false);
    const res = await send(emptyContactId, { email: "priya@example.com" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("No invoices for this customer yet.");
  });

  it("without reports.view_receivables every statement route is refused", async () => {
    expect((await get(`/contacts/${contactId}/statement?${period}`, staffCookie)).status).toBe(403);
    expect((await get(`/contacts/${contactId}/statement.pdf?${period}`, staffCookie)).status).toBe(403);
    expect((await send(contactId, { email: customerEmail }, staffCookie)).status).toBe(403);
  });
});
