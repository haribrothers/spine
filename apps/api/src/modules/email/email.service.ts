import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string }[];
  /** Display name for the From header ("Riverstone Builders <quotes@…>"); the address stays SMTP_FROM. */
  fromName?: string;
}

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
 * Resend/other drivers are "pluggable" per CLAUDE.md's stack table but not
 * built here — SMTP via Nodemailer is Stage 2's only implemented driver,
 * matching the task brief's explicit scope.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null | undefined;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error("SMTP is not configured (SMTP_HOST is unset)");
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
}
