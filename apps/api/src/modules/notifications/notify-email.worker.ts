import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";
import { EmailService } from "../email/email.service";
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
    private readonly queue: QueueService,
    private readonly email: EmailService,
  ) {}

  async onModuleInit() {
    await this.queue.work<NotifyEmailJobData>(NOTIFY_EMAIL_QUEUE, async (job) => {
      await this.process(job.data);
    });
  }

  async process(data: NotifyEmailJobData): Promise<void> {
    if (!this.email.isConfigured()) {
      throw new Error("SMTP is not configured — cannot send owner notification email");
    }
    await this.email.send({
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    });
    this.logger.log(`Owner notification sent to ${data.to}: ${data.subject}`);
  }
}
