import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { EMAIL_KIND_LABELS, EMAIL_LOG_RETENTION_DAYS, type EmailKind, type EmailLogEntry, type EmailLogStatus, type EmailLogStatusSummary } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, creditNotes, emailLog, invoices, jobs, member, payments, quotes, user } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { AuditLogService } from "../audit/audit-log.service";
import { EmailService, queuedEmailContext } from "./email.service";

export const EMAIL_LOG_CLEANUP_QUEUE = "email-log-cleanup";

/**
 * What a queued email says about itself before its worker runs; the worker
 * fills in the real recipient and subject when it sends. For a quote or an
 * invoice, a missing address and subject come from the document.
 */
export interface QueuedEmailMeta {
  orgId: string;
  kind: EmailKind;
  toAddress?: string | null;
  subject?: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
}

export interface EmailLogFilters {
  status?: EmailLogStatus[];
  kind?: EmailKind[];
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  to?: string;
  entityId?: string;
}

/** A queued email's job data carries its log row. */
export interface LoggedJobData {
  emailLogId?: string;
}

const DEFAULT_RETRY_LIMIT = 3;
const WAITING: EmailLogStatus[] = ["queued", "retrying", "sending"];
const DAY = 86_400_000;

const BAD_RETRY = "This email was sent straight away — send it again from its record.";
const BAD_CANCEL = "This email is already being sent.";

/**
 * US-SET-27/28/29 (D-220) — the email log. Queued emails go through
 * `enqueue`, which writes the row and the job together; their worker wraps
 * its work in `attempt`, which moves the row through `sending` to `sent`,
 * `retrying` or `failed`. While email isn't set up a queued email isn't
 * tried at all: it stays `queued` without a job and goes out at the next
 * start once SMTP is configured. Emails sent straight away are recorded by
 * `EmailService.send` itself.
 */
@Injectable()
export class EmailLogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly email: EmailService,
    private readonly audit: AuditLogService,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.work(EMAIL_LOG_CLEANUP_QUEUE, async () => {
      await this.cleanup();
    });
    await this.queue.schedule(EMAIL_LOG_CLEANUP_QUEUE, "40 3 * * *");
    await this.releaseWaiting().catch((err: Error) => this.logger.error(`Couldn't send the emails waiting for email to be set up: ${err.message}`));
  }

  /** Queue an email and record it. The job's data gains `emailLogId`. */
  async enqueue(queueName: string, data: object, meta: QueuedEmailMeta, retry?: { retryLimit: number; retryDelay: number; retryDelayMax?: number }): Promise<void> {
    const { toAddress, subject } = await this.describe(meta);
    const [row] = await this.db
      .insert(emailLog)
      .values({
        orgId: meta.orgId,
        kind: meta.kind,
        toAddress,
        subject,
        entityType: meta.entityType ?? null,
        entityId: meta.entityId ?? null,
        status: "queued",
        attempts: 0,
        maxAttempts: (retry?.retryLimit ?? DEFAULT_RETRY_LIMIT) + 1,
        queue: queueName,
        payload: { ...data, ...(retry ? { __retry: retry } : {}) } as Record<string, unknown>,
        createdByUserId: meta.userId ?? null,
      })
      .returning({ id: emailLog.id });
    try {
      const jobId = await this.queue.send(queueName, { ...data, emailLogId: row!.id }, retry);
      await this.db.update(emailLog).set({ jobId: jobId ?? null }).where(eq(emailLog.id, row!.id));
    } catch (err) {
      const now = new Date();
      await this.db
        .update(emailLog)
        .set({ status: "failed", failedAt: now, lastError: err instanceof Error ? err.message : String(err), updatedAt: now })
        .where(eq(emailLog.id, row!.id));
      throw err;
    }
  }

  /**
   * Runs one try of a queued email. Without a log row (a job queued before
   * the log existed) it just runs. A cancelled email isn't sent; with email
   * not set up the email waits, untried, and the job ends.
   */
  async attempt(logId: string | undefined, run: () => Promise<void>): Promise<void> {
    if (!logId) return run();
    const [row] = await this.db.select({ status: emailLog.status }).from(emailLog).where(eq(emailLog.id, logId));
    if (!row) return run();
    if (row.status === "cancelled") return;
    if (!this.email.isConfigured()) {
      await this.db.update(emailLog).set({ status: "queued", jobId: null, lastError: null, updatedAt: new Date() }).where(eq(emailLog.id, logId));
      return;
    }
    await this.db
      .update(emailLog)
      .set({ status: "sending", attempts: sql`${emailLog.attempts} + 1`, updatedAt: new Date() })
      .where(eq(emailLog.id, logId));
    try {
      await queuedEmailContext.run({ logId }, run);
    } catch (err) {
      const now = new Date();
      await this.db
        .update(emailLog)
        .set({
          status: sql`case when ${emailLog.attempts} >= ${emailLog.maxAttempts} then 'failed'::email_log_status else 'retrying'::email_log_status end`,
          failedAt: sql`case when ${emailLog.attempts} >= ${emailLog.maxAttempts} then now() else null end`,
          lastError: (err instanceof Error ? err.message : String(err)).slice(0, 1000),
          updatedAt: now,
        })
        .where(eq(emailLog.id, logId));
      throw err;
    }
    const now = new Date();
    await this.db.update(emailLog).set({ status: "sent", sentAt: now, lastError: null, failedAt: null, updatedAt: now }).where(eq(emailLog.id, logId));
  }

  /** `GET /emails` — the last 180 days, newest first. */
  async list(orgId: string, filters: EmailLogFilters = {}): Promise<EmailLogEntry[]> {
    const since = new Date(Date.now() - EMAIL_LOG_RETENTION_DAYS * DAY);
    const rows = await this.db
      .select({ log: emailLog, cancelledByName: user.name })
      .from(emailLog)
      .leftJoin(user, eq(emailLog.cancelledByUserId, user.id))
      .where(
        and(
          eq(emailLog.orgId, orgId),
          gte(emailLog.queuedAt, since),
          filters.status?.length ? inArray(emailLog.status, filters.status) : undefined,
          filters.kind?.length ? inArray(emailLog.kind, filters.kind) : undefined,
          filters.from ? gte(emailLog.queuedAt, new Date(`${filters.from}T00:00:00`)) : undefined,
          filters.to ? lt(emailLog.queuedAt, new Date(new Date(`${filters.to}T00:00:00`).getTime() + DAY)) : undefined,
          filters.entityId ? eq(emailLog.entityId, filters.entityId) : undefined,
        ),
      )
      .orderBy(desc(emailLog.queuedAt));
    return this.toEntries(orgId, rows);
  }

  async getOne(orgId: string, id: string): Promise<EmailLogEntry> {
    const rows = await this.db
      .select({ log: emailLog, cancelledByName: user.name })
      .from(emailLog)
      .leftJoin(user, eq(emailLog.cancelledByUserId, user.id))
      .where(and(eq(emailLog.orgId, orgId), eq(emailLog.id, id)));
    if (!rows.length) throw new NotFoundException("Email not found");
    return (await this.toEntries(orgId, rows))[0]!;
  }

  /** US-SET-28 — send a failed or retrying queued email again now; attempts start over. */
  async retry(orgId: string, id: string, actorUserId: string): Promise<EmailLogEntry> {
    const [row] = await this.db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.id, id)));
    if (!row) throw new NotFoundException("Email not found");
    if (!row.queue || !row.payload) throw new BadRequestException(BAD_RETRY);
    if (row.status !== "failed" && row.status !== "retrying") throw new BadRequestException(row.status === "sent" ? "This email was sent." : "This email is already waiting to be sent.");
    if (row.status === "retrying" && row.jobId) await this.queue.cancel(row.queue, row.jobId).catch(() => {});

    const { __retry, ...data } = row.payload as Record<string, unknown> & { __retry?: { retryLimit: number; retryDelay: number; retryDelayMax?: number } };
    const now = new Date();
    await this.db
      .update(emailLog)
      .set({ status: "queued", attempts: 0, lastError: null, failedAt: null, jobId: null, updatedAt: now })
      .where(eq(emailLog.id, id));
    await this.markRecord(row, { emailStatus: "pending", emailError: null });
    if (this.email.isConfigured()) {
      const jobId = await this.queue.send(row.queue, { ...data, emailLogId: id }, __retry);
      await this.db.update(emailLog).set({ jobId: jobId ?? null }).where(eq(emailLog.id, id));
    }
    await this.audit.record(this.db, { orgId, actorUserId, action: "email_retried", entityType: "email", entityId: id, contactId: null, changes: { to: row.toAddress, subject: row.subject } });
    return this.getOne(orgId, id);
  }

  /** US-SET-28 — stop a queued or retrying email before it's sent. */
  async cancel(orgId: string, id: string, actorUserId: string): Promise<EmailLogEntry> {
    const [row] = await this.db.select().from(emailLog).where(and(eq(emailLog.orgId, orgId), eq(emailLog.id, id)));
    if (!row) throw new NotFoundException("Email not found");
    if (row.status !== "queued" && row.status !== "retrying") throw new BadRequestException(row.status === "cancelled" ? "This email was already cancelled." : BAD_CANCEL);
    if (row.queue && row.jobId) {
      const state = (await this.queue.jobStates([row.jobId])).get(row.jobId)?.state;
      if (state === "active") throw new BadRequestException(BAD_CANCEL);
      await this.queue.cancel(row.queue, row.jobId).catch(() => {});
    }
    const now = new Date();
    // Only if it hasn't started meanwhile.
    const [done] = await this.db
      .update(emailLog)
      .set({ status: "cancelled", cancelledAt: now, cancelledByUserId: actorUserId, updatedAt: now })
      .where(and(eq(emailLog.id, id), inArray(emailLog.status, ["queued", "retrying"])))
      .returning({ id: emailLog.id });
    if (!done) throw new BadRequestException(BAD_CANCEL);
    await this.markRecord(row, { emailStatus: "failed", emailError: "Cancelled" });
    await this.audit.record(this.db, { orgId, actorUserId, action: "email_cancelled", entityType: "email", entityId: id, contactId: null, changes: { to: row.toAddress, subject: row.subject } });
    return this.getOne(orgId, id);
  }

  /** US-SET-29 — `GET /emails/status`, and the cards' counts. */
  async status(orgId: string, now = new Date()): Promise<EmailLogStatusSummary> {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const [counts] = await this.db
      .select({
        waiting: sql<number>`count(*) filter (where ${inArray(emailLog.status, WAITING)})::int`,
        failedRecently: sql<number>`count(*) filter (where ${emailLog.status} = 'failed' and ${emailLog.failedAt} >= ${weekAgo.toISOString()})::int`,
        sentToday: sql<number>`count(*) filter (where ${emailLog.status} = 'sent' and ${emailLog.sentAt} >= ${midnight.toISOString()})::int`,
      })
      .from(emailLog)
      .where(eq(emailLog.orgId, orgId));
    // The last 3 queued emails that finished, all failed: say what's wrong.
    const lastThree = await this.db
      .select({ status: emailLog.status, lastError: emailLog.lastError })
      .from(emailLog)
      .where(and(eq(emailLog.orgId, orgId), isNotNull(emailLog.queue), inArray(emailLog.status, ["sent", "failed"])))
      .orderBy(desc(emailLog.updatedAt))
      .limit(3);
    const failing = lastThree.length === 3 && lastThree.every((r) => r.status === "failed");
    return {
      smtpConfigured: this.email.isConfigured(),
      waiting: counts?.waiting ?? 0,
      failedRecently: counts?.failedRecently ?? 0,
      sentToday: counts?.sentToday ?? 0,
      lastError: failing ? (lastThree[0]!.lastError ?? null) : null,
    };
  }

  /** The nightly clean-up: emails older than 180 days leave the log. */
  async cleanup(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - EMAIL_LOG_RETENTION_DAYS * DAY);
    const deleted = await this.db.delete(emailLog).where(lt(emailLog.queuedAt, cutoff)).returning({ id: emailLog.id });
    return deleted.length;
  }

  /** At start-up with email set up: queue the emails that waited for it. */
  async releaseWaiting(): Promise<number> {
    if (!this.email.isConfigured()) return 0;
    const waiting = await this.db
      .select()
      .from(emailLog)
      .where(and(eq(emailLog.status, "queued"), isNull(emailLog.jobId), isNotNull(emailLog.queue), isNotNull(emailLog.payload)));
    for (const row of waiting) {
      const { __retry, ...data } = row.payload as Record<string, unknown> & { __retry?: { retryLimit: number; retryDelay: number; retryDelayMax?: number } };
      const jobId = await this.queue.send(row.queue!, { ...data, emailLogId: row.id }, __retry);
      await this.db.update(emailLog).set({ jobId: jobId ?? null, updatedAt: new Date() }).where(eq(emailLog.id, row.id));
    }
    if (waiting.length) this.logger.log(`Email is set up: ${waiting.length} waiting emails queued`);
    return waiting.length;
  }

  /** "Quote QUO-0031" to the customer's address, until the worker sends the real subject. */
  private async describe(meta: QueuedEmailMeta): Promise<{ toAddress: string; subject: string }> {
    let number: string | null = null;
    let email: string | null = null;
    if (meta.entityId && meta.entityType === "quote") {
      const [q] = await this.db.select({ number: quotes.number, email: contacts.email }).from(quotes).leftJoin(contacts, eq(quotes.contactId, contacts.id)).where(eq(quotes.id, meta.entityId));
      number = q?.number ?? null;
      email = q?.email ?? null;
    } else if (meta.entityId && meta.entityType === "invoice") {
      const [i] = await this.db.select({ number: invoices.number, email: contacts.email }).from(invoices).leftJoin(contacts, eq(invoices.contactId, contacts.id)).where(eq(invoices.id, meta.entityId));
      number = i?.number ?? null;
      email = i?.email ?? null;
    }
    const fallback =
      meta.kind === "quote" ? `Quote ${number ?? ""}`.trim() : meta.kind === "invoice" ? `Invoice ${number ?? ""}`.trim() : meta.kind === "invoice_reminder" ? `Payment reminder — ${number ?? "invoice"}` : EMAIL_KIND_LABELS[meta.kind];
    return { toAddress: meta.toAddress || email || "", subject: meta.subject ?? fallback };
  }

  /** A quote's or invoice's own email status follows a retry or a cancel. */
  private async markRecord(row: typeof emailLog.$inferSelect, set: { emailStatus: "pending" | "failed"; emailError: string | null }) {
    if (!row.entityId) return;
    if (row.kind === "quote") await this.db.update(quotes).set(set).where(eq(quotes.id, row.entityId));
    if (row.kind === "invoice" || row.kind === "invoice_reminder") await this.db.update(invoices).set(set).where(eq(invoices.id, row.entityId));
  }

  private async toEntries(orgId: string, rows: { log: typeof emailLog.$inferSelect; cancelledByName: string | null }[]): Promise<EmailLogEntry[]> {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.log.entityType === type && r.log.entityId).map((r) => r.log.entityId!))];
    const labels = new Map<string, string | null>();
    const fill = (list: { id: string; label: string | null }[]) => list.forEach((r) => labels.set(r.id, r.label));
    const quoteIds = ids("quote");
    if (quoteIds.length) fill(await this.db.select({ id: quotes.id, label: quotes.number }).from(quotes).where(and(eq(quotes.orgId, orgId), inArray(quotes.id, quoteIds))));
    const invoiceIds = ids("invoice");
    if (invoiceIds.length) fill(await this.db.select({ id: invoices.id, label: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds))));
    const noteIds = ids("credit_note");
    if (noteIds.length) fill(await this.db.select({ id: creditNotes.id, label: creditNotes.number }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.id, noteIds))));
    const paymentIds = ids("payment");
    if (paymentIds.length) fill(await this.db.select({ id: payments.id, label: payments.number }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.id, paymentIds))));
    const contactIds = ids("contact");
    if (contactIds.length) fill(await this.db.select({ id: contacts.id, label: contacts.name }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.id, contactIds))));
    const jobIds = ids("job");
    if (jobIds.length) fill(await this.db.select({ id: jobs.id, label: jobs.number }).from(jobs).where(and(eq(jobs.orgId, orgId), inArray(jobs.id, jobIds))));

    // Who an address belongs to: a team member first, else a contact.
    const addresses = [...new Set(rows.map((r) => r.log.toAddress.toLowerCase()).filter(Boolean))];
    const names = new Map<string, string>();
    if (addresses.length) {
      const people = await this.db
        .select({ email: contacts.email, name: contacts.name })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), inArray(sql`lower(${contacts.email})`, addresses)));
      for (const p of people) if (p.email) names.set(p.email.toLowerCase(), p.name);
      const team = await this.db
        .select({ email: user.email, name: user.name })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(eq(member.organizationId, orgId), inArray(sql`lower(${user.email})`, addresses)));
      for (const t of team) names.set(t.email.toLowerCase(), `${t.name} · team`);
    }

    const retrying = rows.filter((r) => r.log.status === "retrying" && r.log.jobId).map((r) => r.log.jobId!);
    const jobStates = await this.queue.jobStates(retrying).catch(() => new Map<string, { state: string; startAfter: Date }>());
    const iso = (d: Date | null) => (d ? d.toISOString() : null);

    return rows.map(({ log, cancelledByName }) => ({
      id: log.id,
      kind: log.kind,
      toAddress: log.toAddress,
      toName: names.get(log.toAddress.toLowerCase()) ?? null,
      subject: log.subject,
      entityType: log.entityType,
      entityId: log.entityId,
      recordLabel: log.entityId ? (labels.get(log.entityId) ?? null) : null,
      status: log.status,
      attempts: log.attempts,
      maxAttempts: log.maxAttempts,
      lastError: log.lastError,
      canRetry: Boolean(log.queue && log.payload) && (log.status === "failed" || log.status === "retrying"),
      canCancel: log.status === "queued" || log.status === "retrying",
      nextAttemptAt: log.status === "retrying" && log.jobId ? iso(jobStates.get(log.jobId)?.startAfter ?? null) : null,
      waitingForSetup: log.status === "queued" && !log.jobId && Boolean(log.queue),
      queuedAt: log.queuedAt.toISOString(),
      sentAt: iso(log.sentAt),
      failedAt: iso(log.failedAt),
      cancelledAt: iso(log.cancelledAt),
      cancelledByName: log.status === "cancelled" ? cancelledByName : null,
    }));
  }
}
