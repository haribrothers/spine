import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { eq } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailKind } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { emailLog } from "../../db/schema";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string }[];
  /** Display name for the From header ("Riverstone Builders <quotes@…>"); the address stays SMTP_FROM. */
  fromName?: string;
  /** US-SET-27 (D-220): what to record in the email log for an email sent straight away. */
  log?: EmailLogRef;
}

/** What the email log records about an email sent straight away. */
export interface EmailLogRef {
  orgId: string | null;
  kind: EmailKind;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
}

/** The message every unconfigured send fails with, as the log shows it. */
export const SMTP_NOT_SET_UP = "Email isn't set up (SMTP_HOST is unset)";

/**
 * Set by `EmailLogService.attempt` while a queued email's worker runs, so the
 * send inside it updates that email's row (the real recipient and subject)
 * instead of writing a new one.
 */
export const queuedEmailContext = new AsyncLocalStorage<{ logId: string }>();

/**
 * Thin Nodemailer/SMTP wrapper — the first real email-sending code in this
 * codebase. Per CLAUDE.md/`.env.example`'s graceful-degradation rule
 * ("Optional — SMTP. If unset, documents still issue and email queues for
 * retry"), this is deliberately NOT the thing that decides whether a
 * caller should attempt sending — `isConfigured()` lets the queue worker
 * (email.worker.ts) skip straight to a "no SMTP configured" outcome without
 * ever constructing a transporter, and `send()` itself throws on failure
 * (unconfigured OR a live SMTP error) so pg-boss's own retry/backoff can
 * do its job — this service does not swallow errors.
 *
 * US-SET-27 (D-220): every send is recorded in `email_log` — a queued
 * email's row (created when it was queued) gets its recipient and subject,
 * and an email sent straight away with `log` gets a row of its own, `sent`
 * or `failed` with the error. Auth's emails construct this class outside
 * Nest's DI graph and pass their own database handle.
 *
 * Resend/other drivers are "pluggable" per CLAUDE.md's stack table but not
 * built here — SMTP via Nodemailer is Stage 2's only implemented driver,
 * matching the task brief's explicit scope.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null | undefined;

  constructor(@Optional() @Inject(DATABASE) private readonly db?: Database) {}

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error(SMTP_NOT_SET_UP);
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    });
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<void> {
    const queued = queuedEmailContext.getStore();
    if (queued && this.db) {
      await this.db.update(emailLog).set({ toAddress: input.to, subject: input.subject, updatedAt: new Date() }).where(eq(emailLog.id, queued.logId));
      await this.deliver(input);
      return;
    }
    const logId = input.log ? await this.open(input.log, input.to, input.subject) : null;
    try {
      await this.deliver(input);
    } catch (err) {
      if (logId) await this.close(logId, err instanceof Error ? err.message : String(err));
      throw err;
    }
    if (logId) await this.close(logId, null);
  }

  /**
   * An email sent straight away that never reached SMTP because email isn't
   * set up (an invitation, a password reset): recorded as failed, so an
   * Owner can see why it didn't arrive.
   */
  async recordNotSent(log: EmailLogRef, to: string, subject: string, reason = SMTP_NOT_SET_UP): Promise<void> {
    const id = await this.open(log, to, subject);
    if (id) await this.close(id, reason);
  }

  private async deliver(input: SendEmailInput): Promise<void> {
    const transporter = this.getTransporter();
    const address = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost";
    const from = input.fromName ? { name: input.fromName, address: address.replace(/^.*<([^>]+)>\s*$/, "$1") } : address;
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
    this.logger.log(`Email sent to ${input.to}: ${input.subject}`);
  }

  /** The log never stops an email: a failed write is logged and the send goes ahead. */
  private async open(log: EmailLogRef, to: string, subject: string): Promise<string | null> {
    if (!this.db) return null;
    try {
      const [row] = await this.db
        .insert(emailLog)
        .values({
          orgId: log.orgId,
          kind: log.kind,
          toAddress: to,
          subject,
          entityType: log.entityType ?? null,
          entityId: log.entityId ?? null,
          status: "sending",
          attempts: 1,
          maxAttempts: 1,
          createdByUserId: log.userId ?? null,
        })
        .returning({ id: emailLog.id });
      return row?.id ?? null;
    } catch (err) {
      this.logger.warn(`Couldn't record an email in the log: ${(err as Error).message}`);
      return null;
    }
  }

  private async close(id: string, error: string | null): Promise<void> {
    if (!this.db) return;
    const now = new Date();
    await this.db
      .update(emailLog)
      .set(error === null ? { status: "sent", sentAt: now, lastError: null, updatedAt: now } : { status: "failed", failedAt: now, lastError: error.slice(0, 1000), updatedAt: now })
      .where(eq(emailLog.id, id))
      .catch((err: Error) => this.logger.warn(`Couldn't update an email in the log: ${err.message}`));
  }
}
