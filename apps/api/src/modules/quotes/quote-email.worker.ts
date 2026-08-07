import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { quotes, contacts } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { EmailService } from "../email/email.service";
import { FilesService } from "../files/files.service";
import { QuotePdfService } from "../pdf/quote-pdf.service";
import { SettingsService } from "../org/settings.service";
import type { QuotePdfBusinessProfile } from "../pdf/quote-pdf.template";

export const QUOTE_SEND_EMAIL_QUEUE = "quote-send-email";

export interface QuoteSendEmailJobData {
  orgId: string;
  quoteId: string;
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
    private readonly files: FilesService,
    private readonly pdf: QuotePdfService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    await this.queue.work<QuoteSendEmailJobData>(QUOTE_SEND_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: QuoteSendEmailJobData): Promise<void> {
    const { orgId, quoteId } = data;

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
      await this.attemptSend(orgId, quoteId, row);
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
  ): Promise<void> {
    const { buffer, filename } = await this.pdf.render(orgId, quoteId);

    // Persist the PDF (best-effort — logged, not fatal, matching
    // pdfFileId's own doc comment: a persistence failure here must not
    // stop the email attempt below, and vice versa).
    if (this.files.isStorageConfigured()) {
      try {
        const uploaded = await this.files.upload(orgId, {
          originalFilename: filename,
          mimeType: "application/pdf",
          buffer,
          uploadedByUserId: null,
        });
        if (uploaded) {
          await this.db.update(quotes).set({ pdfFileId: uploaded.id }).where(eq(quotes.id, quoteId));
        }
      } catch (err) {
        this.logger.warn(`Could not persist PDF for quote ${quoteId}: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(`File storage not configured — PDF for quote ${quoteId} was not persisted (email attempt continues if possible)`);
    }

    if (!row.contactEmail) {
      throw new Error(`Quote ${quoteId}'s contact has no email address on file — cannot send`);
    }
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send quote email");
    }

    const business = await this.settings.get<QuotePdfBusinessProfile>(orgId, "business_profile");
    const businessName = business?.name || "Spine";
    const quoteNumber = row.quote.number ?? "your quote";

    await this.email.send({
      to: row.contactEmail,
      subject: `${businessName} sent you a quote (${quoteNumber})`,
      text: [
        `Hi ${row.contactName ?? "there"},`,
        "",
        `${businessName} has sent you a quote (${quoteNumber}), attached as a PDF.`,
        "",
        "This is an automated email — please reply directly to discuss the quote.",
      ].join("\n"),
      attachments: [{ filename, content: buffer, contentType: "application/pdf" }],
    });
  }
}
