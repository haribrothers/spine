import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { progressClaimLabel } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, contacts, jobs } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { EmailService } from "../email/email.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { SettingsService } from "../org/settings.service";
import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { invoiceEmail } from "../email/email-templates";
import { loadEmailText, type EmailJobOverride } from "../email/email-text";

export const INVOICE_SEND_EMAIL_QUEUE = "invoice-send-email";


export interface InvoiceSendEmailJobData {
  orgId: string;
  invoiceId: string;
  /** S-05.10 — same worker, reminder-specific subject/body (see attemptSend's own branch) instead of the standard "here's your invoice" copy. Does not affect emailStatus/pdfFileId bookkeeping, which stays identical either way. */
  isReminder?: boolean;
  /** US-INV-19 — days past the due date the reminder run worked out (negative = due in that many days). */
  daysOverdue?: number;
  /** US-SET-21 — what the "Send" dialog changed for this one email. */
  override?: EmailJobOverride;
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
    private readonly issuedPdf: IssuedPdfService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    await this.queue.work<InvoiceSendEmailJobData>(INVOICE_SEND_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: InvoiceSendEmailJobData): Promise<void> {
    const { orgId, invoiceId, isReminder = false, daysOverdue, override } = data;

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
      await this.attemptSend(orgId, invoiceId, row, isReminder, daysOverdue, override);
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
    scheduledDaysOverdue?: number,
    override?: EmailJobOverride,
  ): Promise<void> {
    // US-INV-17: attach the PDF stored when the invoice was issued (stored now if it isn't yet).
    // US-RPT-17: an opening invoice has none, so its reminders go without one.
    const pdf = row.invoice.type === "opening" ? null : await this.issuedPdf.forEmail(orgId, "invoice", invoiceId);

    const to = override?.to ?? row.contactEmail;
    if (!to) {
      throw new Error(`Invoice ${invoiceId}'s contact has no email address on file — cannot send`);
    }
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send invoice email");
    }

    const brand = await loadEmailBrand(this.db, orgId);
    const invoice = row.invoice;
    // US-JOB-21: retention held back isn't due now.
    const balanceDue = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
    // S-05.10 — a reminder says how many days overdue rather than restating the date.
    const daysOverdue =
      scheduledDaysOverdue ??
      (invoice.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (24 * 60 * 60 * 1000))) : null);

    // US-JOB-29: "Progress claim 3 · JOB-002" for a numbered progress claim.
    let claimLabel: string | null = null;
    if (invoice.progressClaimNo && invoice.jobId) {
      const [job] = await this.db.select({ number: jobs.number }).from(jobs).where(eq(jobs.id, invoice.jobId));
      claimLabel = progressClaimLabel(invoice.progressClaimNo, { jobNumber: job?.number, voided: invoice.status === "void" });
    }
    const template = invoiceEmail({
      claimLabel,
      businessName: brand.name,
      locale: brand.locale,
      contactName: row.contactName,
      number: invoice.number ?? "your invoice",
      currency: invoice.currency,
      total: invoice.totalAmount,
      retention: invoice.retentionAmount,
      balanceDue,
      dueDate: invoice.dueDate,
      reminder: isReminder ? { daysOverdue } : undefined,
      // US-INV-15: the instructions kept with the invoice when it was issued.
      paymentInstructions: invoice.paymentInstructions,
      upiQrAmount: invoice.upiQrAmount,
      // US-SET-21: the invoice's or the reminder's words, as saved or as edited in the "Send" dialog.
      text: await loadEmailText(this.db, orgId, isReminder ? "reminder" : "invoice", override),
    });
    const email = renderEmail(brand, template.content);

    await this.email.send({
      to,
      fromName: brand.name,
      subject: template.subject,
      text: email.text,
      html: email.html,
      attachments: [...(pdf && override?.attachPdf !== false ? [{ filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" }] : []), ...email.attachments],
    });
  }
}
