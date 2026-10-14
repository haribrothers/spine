import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, type AttentionItem, type EmailLogEntry, type EmailLogStatusSummary } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, emailLog, invoices, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { INVOICE_SEND_EMAIL_QUEUE, InvoiceEmailWorker, type InvoiceSendEmailJobData } from "../invoices/invoice-email.worker";
import { QueueService } from "../queue/queue.service";
import { EmailLogService } from "./email-log.service";
import { EmailService } from "./email.service";

/**
 * US-SET-27–29, US-DASH-30 (D-220) — the email log: every email recorded,
 * queued ones moved through their tries, retry and cancel, the "not set up"
 * status, the clean-up, and failed emails on an Owner's dashboard. Requires
 * local Postgres.
 */
describe("US-SET-27 to US-SET-29, US-DASH-30 · the email log (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let ownerId: string;
  let owner: string;
  let staff: string;
  let contactId: string;
  let invoiceId: string;
  const emails: string[] = [];
  const queued: { name: string; data: InvoiceSendEmailJobData; id: string }[] = [];
  const delivered: { to: string; subject: string }[] = [];
  let smtp = true;

  const call = async (who: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie: who, "content-type": "application/json", ...(method === "POST" ? { "idempotency-key": randomUUID() } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const list = async (query = "") => (await (await call(owner, "GET", `/emails${query}`)).json()) as EmailLogEntry[];
  const latestJob = () => queued.at(-1)!;
  const runLatest = async () => testApp.app.get(InvoiceEmailWorker).process(latestJob().data).catch(() => undefined);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    vi.spyOn(testApp.app.get(QueueService), "send").mockImplementation(async (name: string, data: object) => {
      const id = randomUUID();
      if (name === INVOICE_SEND_EMAIL_QUEUE) queued.push({ name, data: data as InvoiceSendEmailJobData, id });
      return id;
    });
    vi.spyOn(testApp.app.get(QueueService), "cancel").mockResolvedValue(undefined);
    vi.spyOn(testApp.app.get(QueueService), "jobStates").mockResolvedValue(new Map());
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockImplementation(() => smtp);
    vi.spyOn(emailService as unknown as { deliver: (input: { to: string; subject: string }) => Promise<void> }, "deliver").mockImplementation(async (input) => {
      if (!smtp) throw new Error("Email isn't set up (SMTP_HOST is unset)");
      delivered.push({ to: input.to, subject: input.subject });
    });

    const ownerEmail = `us-set-27-${randomUUID()}@example.com`;
    emails.push(ownerEmail);
    const o = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Priya Raman" });
    owner = o.cookie;
    ownerId = o.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, o.userId)))[0]!.organizationId;

    const staffEmail = `us-set-27-staff-${randomUUID()}@example.com`;
    emails.push(staffEmail);
    const s = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Sarah Mendes" });
    staff = s.cookie;
    await db.delete(member).where(eq(member.userId, s.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: s.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, s.userId));

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Halcyon Tech Parks", email: "accounts@halcyontech.example", createdByUserId: o.userId }).returning();
    contactId = contact!.id;
    const invoicesService = testApp.app.get(InvoicesService);
    const draft = await invoicesService.create(orgId, o.userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "50000" }] }));
    invoiceId = (await invoicesService.issue(orgId, draft.id, o.userId)).id;
  }, 120_000);

  beforeEach(() => {
    smtp = true;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  describe("US-SET-27", () => {
    it("records a queued invoice email as queued, then sent with its real subject", async () => {
      expect((await call(owner, "POST", `/invoices/${invoiceId}/send-email`, {})).status).toBeLessThan(300);
      const job = latestJob();
      expect(job.data.emailLogId).toBeTruthy();

      const [waiting] = await list(`?entityId=${invoiceId}`);
      expect(waiting).toMatchObject({ kind: "invoice", status: "queued", toAddress: "accounts@halcyontech.example", toName: "Halcyon Tech Parks", entityType: "invoice", attempts: 0, maxAttempts: 4, canCancel: true, canRetry: false });
      expect(waiting!.recordLabel).toMatch(/^INV-/);
      expect(waiting!.subject).toMatch(/INV-/);

      await runLatest();
      const [sent] = await list(`?entityId=${invoiceId}`);
      expect(sent).toMatchObject({ id: waiting!.id, status: "sent", attempts: 1, canCancel: false, lastError: null });
      expect(sent!.sentAt).toBeTruthy();
      expect(sent!.subject).toBe(delivered.at(-1)!.subject);
    });

    it("records an email sent straight away, with its kind and record", async () => {
      await testApp.app.get(EmailService).send({ to: "accounts@halcyontech.example", subject: "Statement for October", text: "Hi", log: { orgId, kind: "statement", entityType: "contact", entityId: contactId, userId: ownerId } });
      const [row] = await list(`?entityId=${contactId}`);
      expect(row).toMatchObject({ kind: "statement", status: "sent", recordLabel: "Halcyon Tech Parks", attempts: 1, maxAttempts: 1, canRetry: false, canCancel: false });
    });

    it("records a failed direct send with its error, and never stores bodies", async () => {
      smtp = false;
      await expect(testApp.app.get(EmailService).send({ to: "finance@example.com", subject: "Receipt RCP-0001", text: "secret body", log: { orgId, kind: "receipt" } })).rejects.toThrow();
      const [row] = await list("?kind=receipt");
      expect(row).toMatchObject({ status: "failed", lastError: "Email isn't set up (SMTP_HOST is unset)" });
      const [stored] = await db.select().from(emailLog).where(eq(emailLog.id, row!.id));
      expect(JSON.stringify(stored)).not.toContain("secret body");
    });

    it("filters by status and kind", async () => {
      expect((await list("?status=sent")).every((e) => e.status === "sent")).toBe(true);
      expect((await list("?kind=statement")).every((e) => e.kind === "statement")).toBe(true);
    });

    it("is Owner-only", async () => {
      expect((await call(staff, "GET", "/emails")).status).toBe(403);
      expect((await call(staff, "GET", "/emails/status")).status).toBe(403);
    });

    it("the nightly clean-up removes emails older than 180 days", async () => {
      const [old] = await db.insert(emailLog).values({ orgId, kind: "notification", toAddress: "a@example.com", subject: "Old", status: "sent", queuedAt: new Date(Date.now() - 181 * 86_400_000) }).returning();
      await testApp.app.get(EmailLogService).cleanup();
      expect(await db.select().from(emailLog).where(eq(emailLog.id, old!.id))).toHaveLength(0);
    });
  });

  describe("US-SET-28", () => {
    it("a failing queued email retries, then fails; Retry now queues it again with attempts starting over", async () => {
      await db.update(contacts).set({ email: null }).where(eq(contacts.id, contactId));
      await call(owner, "POST", `/invoices/${invoiceId}/send-email`, {});
      const job = latestJob();
      await runLatest();
      let [row] = await list(`?entityId=${invoiceId}`);
      expect(row).toMatchObject({ status: "retrying", attempts: 1, canRetry: true, canCancel: true });
      expect(row!.lastError).toMatch(/no email address/);

      for (let i = 0; i < 3; i++) await testApp.app.get(InvoiceEmailWorker).process(job.data).catch(() => undefined);
      [row] = await list(`?entityId=${invoiceId}`);
      expect(row).toMatchObject({ status: "failed", attempts: 4, canRetry: true, canCancel: false });

      await db.update(contacts).set({ email: "accounts@halcyontech.example" }).where(eq(contacts.id, contactId));
      const jobsBefore = queued.length;
      const retried = (await (await call(owner, "POST", `/emails/${row!.id}/retry`)).json()) as EmailLogEntry;
      expect(retried).toMatchObject({ id: row!.id, status: "queued", attempts: 0, lastError: null });
      expect(queued.length).toBe(jobsBefore + 1);
      expect(latestJob().data.emailLogId).toBe(row!.id);
      const [inv] = await db.select({ emailStatus: invoices.emailStatus }).from(invoices).where(eq(invoices.id, invoiceId));
      expect(inv!.emailStatus).toBe("pending");

      await runLatest();
      [row] = await list(`?entityId=${invoiceId}`);
      expect(row).toMatchObject({ status: "sent", attempts: 1 });
    });

    it("an email sent straight away can't be retried from the log", async () => {
      smtp = false;
      await testApp.app.get(EmailService).send({ to: "x@example.com", subject: "Credit note CRN-0001", text: "-", log: { orgId, kind: "credit_note" } }).catch(() => undefined);
      const [row] = await list("?kind=credit_note");
      expect(row!.canRetry).toBe(false);
      const res = await call(owner, "POST", `/emails/${row!.id}/retry`);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("This email was sent straight away — send it again from its record.");
    });

    it("cancels a queued email: it's never sent and the invoice says so", async () => {
      await call(owner, "POST", `/invoices/${invoiceId}/send-email`, {});
      const job = latestJob();
      const id = job.data.emailLogId!;
      const cancelled = (await (await call(owner, "POST", `/emails/${id}/cancel`)).json()) as EmailLogEntry;
      expect(cancelled).toMatchObject({ status: "cancelled", cancelledByName: "Priya Raman", canCancel: false, canRetry: false });
      const [inv] = await db.select({ emailStatus: invoices.emailStatus, emailError: invoices.emailError }).from(invoices).where(eq(invoices.id, invoiceId));
      expect(inv).toEqual({ emailStatus: "failed", emailError: "Cancelled" });

      const before = delivered.length;
      await testApp.app.get(InvoiceEmailWorker).process(job.data);
      expect(delivered.length).toBe(before);
    });

    it("a sent email can't be cancelled", async () => {
      const [sent] = await list("?status=sent");
      const res = await call(owner, "POST", `/emails/${sent!.id}/cancel`);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe("This email is already being sent.");
    });

    it("Staff can't retry or cancel", async () => {
      const [any] = await list();
      expect((await call(staff, "POST", `/emails/${any!.id}/retry`)).status).toBe(403);
      expect((await call(staff, "POST", `/emails/${any!.id}/cancel`)).status).toBe(403);
    });
  });

  describe("US-SET-29", () => {
    it("with email not set up, a queued email waits untried and goes out once it's set up", async () => {
      smtp = false;
      await call(owner, "POST", `/invoices/${invoiceId}/send-email`, {});
      const id = latestJob().data.emailLogId!;
      await runLatest();
      const [row] = await list(`?entityId=${invoiceId}`);
      expect(row).toMatchObject({ id, status: "queued", attempts: 0, waitingForSetup: true });

      const status = (await (await call(owner, "GET", "/emails/status")).json()) as EmailLogStatusSummary;
      expect(status.smtpConfigured).toBe(false);
      expect(status.waiting).toBeGreaterThanOrEqual(1);

      smtp = true;
      const jobsBefore = queued.length;
      expect(await testApp.app.get(EmailLogService).releaseWaiting()).toBeGreaterThanOrEqual(1);
      expect(queued.slice(jobsBefore).map((j) => j.data.emailLogId)).toContain(id);
      await testApp.app.get(InvoiceEmailWorker).process(queued.slice(jobsBefore).find((j) => j.data.emailLogId === id)!.data);
      expect((await list(`?entityId=${invoiceId}`))[0]).toMatchObject({ id, status: "sent", waitingForSetup: false });
    });

    it("says what's wrong when the last 3 queued emails in a row failed", async () => {
      const at = Date.now();
      await db.insert(emailLog).values(
        [1, 2, 3].map((i) => ({ orgId, kind: "notification" as const, toAddress: "t@example.com", subject: `N${i}`, status: "failed" as const, queue: "notify-email", lastError: "535 Authentication failed", attempts: 4, maxAttempts: 4, failedAt: new Date(at), updatedAt: new Date(at + i * 1000) })),
      );
      const status = (await (await call(owner, "GET", "/emails/status")).json()) as EmailLogStatusSummary;
      expect(status).toMatchObject({ smtpConfigured: true, lastError: "535 Authentication failed" });
      expect(status.failedRecently).toBeGreaterThanOrEqual(3);
    });
  });

  describe("US-DASH-30", () => {
    it("an Owner's Needs your attention lists failed emails; Staff's doesn't", async () => {
      const ownerRows = (await (await call(owner, "GET", "/dashboard/attention")).json()) as AttentionItem[];
      const row = ownerRows.find((r) => r.kind === "emails_failed");
      expect(row?.count).toBeGreaterThanOrEqual(1);
      expect(row!.items[0]!.name).toBeTruthy();
      const staffRows = (await (await call(staff, "GET", "/dashboard/attention")).json()) as AttentionItem[];
      expect(staffRows.some((r) => r.kind === "emails_failed")).toBe(false);
    });
  });
});
