import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { QueueService } from "../queue/queue.service";
import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { notificationEmail } from "../email/email-templates";
import { EmailService } from "../email/email.service";
import { EmailLogService } from "../email/email-log.service";
import { NOTIFY_EMAIL_QUEUE, type NotifyEmailJobData } from "./notifications.service";

/**
 * Consumer side of `NotificationsService.notify()` — the same pg-boss
 * worker pattern as `QuoteEmailWorker` (self-registers at boot via
 * `onModuleInit`, runs in the same process as the API server). Kept
 * intentionally dumb: given `{to, subject, text, html}`, just calls
 * `EmailService.send`. If SMTP is unconfigured, `EmailService.send` throws
 * and pg-boss's own retry/backoff (configured in `QueueService.send`)
 * handles it — same graceful-degradation posture as every other queued
 * email in this codebase; a down/unconfigured SMTP server must never
 * surface as a failure of whatever public action queued the notification.
 */
@Injectable()
export class NotifyEmailWorker implements OnModuleInit {
  private readonly logger = new Logger(NotifyEmailWorker.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly email: EmailService,
    private readonly emailLog: EmailLogService,
  ) {}

  async onModuleInit() {
    await this.queue.work<NotifyEmailJobData>(NOTIFY_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: NotifyEmailJobData): Promise<void> {
    // US-SET-27: each try is recorded in the email log; with email not set up the email waits there, untried.
    await this.emailLog.attempt(data.emailLogId, () => this.tryOnce(data));
  }

  private async tryOnce(data: NotifyEmailJobData): Promise<void> {
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send owner notification email");
    }
    if (!data.orgId) {
      // Queued before the branded layout (US-NTF-11); sent as it was written.
      await this.email.send({ to: data.to, subject: data.subject, text: data.text, html: data.html });
    } else {
      const brand = await loadEmailBrand(this.db, data.orgId);
      const template = notificationEmail({ businessName: brand.name, subject: data.subject, text: data.text, link: data.link });
      const email = renderEmail(brand, template.content);
      await this.email.send({
        to: data.to,
        fromName: brand.name,
        subject: template.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
      });
    }
    this.logger.log(`Owner notification sent to ${data.to}: ${data.subject}`);
  }
}
