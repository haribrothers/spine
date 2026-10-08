import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { quotes, contacts } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { EmailService } from "../email/email.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";
import { SettingsService } from "../org/settings.service";
import { loadEmailBrand } from "../email/email-brand";
import { appUrl, renderEmail } from "../email/email-layout";
import { quoteEmail } from "../email/email-templates";
import { loadEmailText, type EmailJobOverride } from "../email/email-text";

export const QUOTE_SEND_EMAIL_QUEUE = "quote-send-email";


export interface QuoteSendEmailJobData {
  orgId: string;
  quoteId: string;
  /**
   * PRD F3 Stage 3 (S-03.4/S-03.5) — the signed public-quote token minted
   * by `QuotesService.send()` in the same transaction as the number
   * allocation, so this worker can build a real accept/reject link into
   * the email body without knowing anything about how tokens are minted or
   * verified. Optional only for backward compatibility with any job already
   * sitting in the pg-boss queue from before this field existed (an
   * in-flight deploy) — a normal `send()` call always supplies it now.
   */
  publicToken?: string;
  /** US-SET-21 — what the "Send" dialog changed for this one email. */
  override?: EmailJobOverride;
}

/**
 * PRD S-03.4 — the actual consumer side of the "email a quote" job
 * `QuotesService.send()` enqueues. Registered as a pg-boss worker at boot
 * (`onModuleInit`) so it runs in the same process as the API server (see
 * `QueueService`'s own comment on why this is a single-process design) —
 * `pnpm --filter @spine/api dev`/`start` starts this worker automatically,
 * no separate command required.
 *
 * Does two things per job, in order (inside `attemptSend`, called by
 * `process` — see that method for the `quotes.emailStatus`/`emailError`/
 * `emailSentAt` bookkeeping wrapped around it, which is what makes the
 * outcome visible on the quote detail page rather than only in pg-boss's
 * own job table):
 *  1. Renders the quote's PDF (via `QuotePdfService`, the exact same
 *     renderer `GET /quotes/:id/pdf` uses) and persists it through
 *     `FilesService`, then stores that file's id on `quotes.pdfFileId` —
 *     "documents snapshot their data" extended to rendered output: this is
 *     the permanent PDF-as-emailed record, not regenerated later from
 *     possibly-since-changed template code.
 *  2. If SMTP is configured AND the contact has an email address, sends
 *     the PDF as an attachment via `EmailService`. If SMTP isn't
 *     configured, or the contact has no email, or the SMTP send itself
 *     fails, this method throws — pg-boss's own retry/backoff (configured
 *     in `QueueService.send`) handles re-attempting a transient SMTP
 *     failure. A permanently unconfigured SMTP server will exhaust its
 *     retries and the job ends up `failed` in pg-boss's own job table AND
 *     `quotes.emailStatus = "failed"` with `emailError` set to the last
 *     attempt's message — both the quote detail page and (for a cross-quote
 *     view) `GET /quotes/email-queue` can now answer "did this send?"
 *     without inspecting pg-boss directly.
 *
 * Critically, PDF persistence (step 1) is attempted even when SMTP is
 * unconfigured — a "Download PDF" affordance should still get the
 * as-issued snapshot even if email was never possible, and a later SMTP
 * config change plus a manual re-queue shouldn't be the only way to get a
 * persisted PDF for an already-sent quote.
 */
@Injectable()
export class QuoteEmailWorker implements OnModuleInit {
  private readonly logger = new Logger(QuoteEmailWorker.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly email: EmailService,
    private readonly issuedPdf: IssuedPdfService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    await this.queue.work<QuoteSendEmailJobData>(QUOTE_SEND_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: QuoteSendEmailJobData): Promise<void> {
    const { orgId, quoteId, publicToken, override } = data;

    const [row] = await this.db
      .select({ quote: quotes, contactName: contacts.name, contactEmail: contacts.email })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    if (!row) {
      this.logger.warn(`Quote ${quoteId} (org ${orgId}) no longer exists — skipping queued send-email job`);
      return;
    }

    try {
      await this.attemptSend(orgId, quoteId, row, publicToken, override);
      await this.db
        .update(quotes)
        .set({ emailStatus: "sent", emailError: null, emailSentAt: new Date() })
        .where(eq(quotes.id, quoteId));
    } catch (err) {
      // Written on EVERY failed attempt, not only the final one — the plain
      // `Job<T>` pg-boss hands to a `work()` handler has no `retryCount`/
      // `retryLimit` (only `JobWithMetadata<T>`, fetched separately, does),
      // so this handler genuinely cannot tell "this was the last retry"
      // from "another attempt is still coming". Writing "failed" here and
      // flipping it back to "sent" if a later retry succeeds (the `try`
      // branch above) is more honest than staying silent about a real
      // failed attempt, at the cost of `emailStatus` briefly reading
      // "failed" mid-retry rather than "pending" the whole time — an
      // accepted tradeoff given the API's actual shape.
      const message = err instanceof Error ? err.message : String(err);
      await this.db.update(quotes).set({ emailStatus: "failed", emailError: message }).where(eq(quotes.id, quoteId));
      throw err; // re-throw so pg-boss's own retry/backoff still applies
    }
  }

  private async attemptSend(
    orgId: string,
    quoteId: string,
    row: { quote: typeof quotes.$inferSelect; contactName: string | null; contactEmail: string | null },
    publicToken: string | undefined,
    override?: EmailJobOverride,
  ): Promise<void> {
    // US-INV-17: attach the PDF stored when the quote was sent (stored now if it isn't yet).
    const { buffer, filename } = await this.issuedPdf.forEmail(orgId, "quote", quoteId);
    const to = override?.to ?? row.contactEmail;

    if (!to) {
      throw new Error(`Quote ${quoteId}'s contact has no email address on file — cannot send`);
    }
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send quote email");
    }

    const brand = await loadEmailBrand(this.db, orgId);
    const quoteNumber = row.quote.number ?? "your quote";

    // A real web page, not the API's JSON endpoint. `publicToken` is only
    // missing for a job queued by an older deploy; the email still goes,
    // without the button.
    const quoteLink = publicToken ? appUrl(`/quote/${publicToken}`) : null;

    // US-NTF-10/11 — the shared branded layout.
    const template = quoteEmail({
      businessName: brand.name,
      locale: brand.locale,
      contactName: row.contactName,
      number: quoteNumber,
      total: row.quote.totalAmount,
      currency: row.quote.currency,
      validUntil: row.quote.validUntil,
      link: quoteLink,
      text: await loadEmailText(this.db, orgId, "quote", override),
    });
    const email = renderEmail(brand, template.content);

    await this.email.send({
      to,
      fromName: brand.name,
      subject: template.subject,
      text: email.text,
      html: email.html,
      attachments: [...(override?.attachPdf === false ? [] : [{ filename, content: buffer, contentType: "application/pdf" }]), ...email.attachments],
    });
  }
}
