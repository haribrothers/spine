import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, user } from "../../db/schema";
import { QueueService } from "../queue/queue.service";

export const NOTIFY_EMAIL_QUEUE = "notify-email";

export interface NotifyEmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * A real, reusable "notify the org owner(s) about X" capability —
 * `NotificationsModule` was an empty stub until PRD F3 Stage 3 (S-03.7,
 * "As an owner, I want to be notified the moment a quote is viewed or
 * accepted"). This codebase has NO in-app notification UI (no bell icon,
 * confirmed by grep across apps/web before writing this) — building one as
 * a side effect of Quotes Stage 3 would be well outside this stage's scope,
 * so the notification channel is email, reusing the exact same
 * `EmailService`/`QueueService` pg-boss infrastructure Stage 2 already
 * built for quote-send emails (see quote-email.worker.ts) rather than
 * inventing a second delivery mechanism.
 *
 * Deliberately generic: `notify(orgId, { subject, text })` looks up the
 * org's owner(s) and queues one email per owner. Nothing here is
 * Quotes-specific — Invoices/Payments (future phases) can call this same
 * method for their own "notify the owner" needs without adding a new
 * module. Queued via pg-boss (not sent inline) for the same
 * graceful-degradation reason as quote-send-email: SMTP being down or
 * unconfigured must never block the customer-facing action (a public quote
 * view/accept/reject) that triggered the notification.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
  ) {}

  /**
   * Queues one notification email per active owner of `orgId`. Never
   * throws — a failure to look up owners or to enqueue is logged and
   * swallowed, exactly matching `QuotesService.send()`'s own posture on its
   * email-enqueue call: the action that triggered a notification (an
   * already-committed public accept/view) must never be blocked or failed
   * by this being unable to notify anyone.
   */
  async notify(orgId: string, params: { subject: string; text: string; html?: string }): Promise<void> {
    try {
      const owners = await this.db
        .select({ email: user.email })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(eq(member.organizationId, orgId), eq(member.role, "owner"), eq(member.isActive, true)));

      if (!owners.length) {
        this.logger.warn(`No active owner found for org ${orgId} — notification "${params.subject}" was not sent to anyone`);
        return;
      }

      await Promise.all(
        owners.map((owner) =>
          this.queue.send(NOTIFY_EMAIL_QUEUE, {
            to: owner.email,
            subject: params.subject,
            text: params.text,
            html: params.html,
          } satisfies NotifyEmailJobData),
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue owner notification for org ${orgId} ("${params.subject}")`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
