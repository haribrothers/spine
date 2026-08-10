import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, contacts } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { EmailService } from "../email/email.service";
import { FilesService } from "../files/files.service";
import { InvoicePdfService } from "../pdf/invoice-pdf.service";
import { SettingsService } from "../org/settings.service";
import type { InvoicePdfBusinessProfile } from "../pdf/invoice-pdf.template";
import { toDecimalString } from "@spine/shared";

export const INVOICE_SEND_EMAIL_QUEUE = "invoice-send-email";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface InvoiceSendEmailJobData {
  orgId: string;
  invoiceId: string;
  /** S-05.10 — same worker, reminder-specific subject/body (see attemptSend's own branch) instead of the standard "here's your invoice" copy. Does not affect emailStatus/pdfFileId bookkeeping, which stays identical either way. */
  isReminder?: boolean;
}

/**
 * S-05.7 — the actual consumer side of the "email an invoice" job
 * `InvoicesService.sendEmail()` enqueues. Structurally a near-exact copy of
 * `QuoteEmailWorker` (same PDF-persist-then-attach-and-send shape, same
 * `emailStatus`/`emailError`/`emailSentAt` bookkeeping, same graceful-
 * degradation posture on unconfigured SMTP/missing contact email) — see
 * that worker's own doc comment for the full reasoning, not repeated here.
 * The one real difference: invoices have no public accept/reject link
 * (that's a quotes-only Stage 3 concept), so the email body includes a
 * balance-due summary instead of a "view online" link — the closest thing
 * S-05.7's "payment instructions" wording asks for that this stage can
 * actually back up (no payment link/gateway exists yet, just the fact of
 * what's owed and by when).
 */
@Injectable()
export class InvoiceEmailWorker implements OnModuleInit {
  private readonly logger = new Logger(InvoiceEmailWorker.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly email: EmailService,
    private readonly files: FilesService,
    private readonly pdf: InvoicePdfService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    await this.queue.work<InvoiceSendEmailJobData>(INVOICE_SEND_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: InvoiceSendEmailJobData): Promise<void> {
    const { orgId, invoiceId, isReminder = false } = data;

    const [row] = await this.db
      .select({ invoice: invoices, contactName: contacts.name, contactEmail: contacts.email })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
    if (!row) {
      this.logger.warn(`Invoice ${invoiceId} (org ${orgId}) no longer exists — skipping queued send-email job`);
      return;
    }

    try {
      await this.attemptSend(orgId, invoiceId, row, isReminder);
      await this.db
        .update(invoices)
        .set({ emailStatus: "sent", emailError: null, emailSentAt: new Date() })
        .where(eq(invoices.id, invoiceId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.update(invoices).set({ emailStatus: "failed", emailError: message }).where(eq(invoices.id, invoiceId));
      throw err; // re-throw so pg-boss's own retry/backoff still applies
    }
  }

  private async attemptSend(
    orgId: string,
    invoiceId: string,
    row: { invoice: typeof invoices.$inferSelect; contactName: string | null; contactEmail: string | null },
    isReminder: boolean,
  ): Promise<void> {
    const { buffer, filename } = await this.pdf.render(orgId, invoiceId);

    if (this.files.isStorageConfigured()) {
      try {
        const uploaded = await this.files.upload(orgId, {
          originalFilename: filename,
          mimeType: "application/pdf",
          buffer,
          uploadedByUserId: null,
        });
        if (uploaded) {
          await this.db.update(invoices).set({ pdfFileId: uploaded.id }).where(eq(invoices.id, invoiceId));
        }
      } catch (err) {
        this.logger.warn(`Could not persist PDF for invoice ${invoiceId}: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(`File storage not configured — PDF for invoice ${invoiceId} was not persisted (email attempt continues if possible)`);
    }

    if (!row.contactEmail) {
      throw new Error(`Invoice ${invoiceId}'s contact has no email address on file — cannot send`);
    }
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send invoice email");
    }

    const business = await this.settings.get<InvoicePdfBusinessProfile>(orgId, "business_profile");
    const businessName = business?.name || "Spine";
    const invoiceNumber = row.invoice.number ?? "your invoice";
    const currency = row.invoice.currency;
    const balanceDue = row.invoice.totalAmount - row.invoice.amountPaid - row.invoice.creditedAmount;
    const dueDateText = row.invoice.dueDate ? new Date(row.invoice.dueDate).toLocaleDateString() : null;

    const balanceLine =
      balanceDue > 0n
        ? `The balance due is ${toDecimalString({ amount: balanceDue, currency })} ${currency}${dueDateText ? `, due ${dueDateText}` : ""}.`
        : "This invoice is already paid in full — no balance is owing.";

    // S-05.10 — same PDF, same attachment, only the subject/opening line
    // change: a reminder says "this is now overdue" instead of "here's your
    // invoice", using days-overdue rather than the due date itself (a
    // reminder is inherently sent because the due date has already passed,
    // so restating it plainly is more useful than repeating the date).
    const daysOverdueText = row.invoice.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(row.invoice.dueDate).getTime()) / (24 * 60 * 60 * 1000)))
      : null;
    const subject = isReminder
      ? `Reminder: ${invoiceNumber} is now ${daysOverdueText !== null ? `${daysOverdueText} day${daysOverdueText === 1 ? "" : "s"} ` : ""}overdue`
      : `${businessName} sent you an invoice (${invoiceNumber})`;
    const openingLine = isReminder
      ? `This is a friendly reminder that invoice ${invoiceNumber} from ${businessName} is now overdue.`
      : `${businessName} has sent you an invoice (${invoiceNumber}), attached as a PDF.`;

    await this.email.send({
      to: row.contactEmail,
      subject,
      text: [
        `Hi ${row.contactName ?? "there"},`,
        "",
        openingLine,
        "",
        balanceLine,
        "",
        "This is an automated email — please reply directly with any payment questions.",
      ].join("\n"),
      html: [
        `<p>Hi ${escapeHtml(row.contactName ?? "there")},</p>`,
        `<p>${escapeHtml(openingLine)}</p>`,
        `<p>${escapeHtml(balanceLine)}</p>`,
        `<p style="color:#888;font-size:12px;">This is an automated email — please reply directly with any payment questions.</p>`,
      ].join("\n"),
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
    });
  }
}
