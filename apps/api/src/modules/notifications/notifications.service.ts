import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, notifications, user } from "../../db/schema";
import { QueueService } from "../queue/queue.service";
import { PushService } from "./push.service";

export const NOTIFY_EMAIL_QUEUE = "notify-email";

export interface NotifyEmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * A real, reusable "notify org members about X" capability —
 * `NotificationsModule` was an empty stub until PRD F3 Stage 3 (S-03.7,
 * "As an owner, I want to be notified the moment a quote is viewed or
 * accepted"). Two delivery channels, both driven by one `notify()` call:
 * email (the original Stage 3 channel, reusing `EmailService`/`QueueService`
 * pg-boss infrastructure), a persisted in-app row (PRD S-10.11, added
 * 2026-08-08) read by `NotificationsController`'s list/unread-count/mark-read
 * endpoints and shown in the web app's bell + drawer, and browser/OS push
 * (PRD S-10.12, added 2026-08-08) via `PushService` — fires even when the
 * tab is backgrounded or closed, for every device the recipient opted in
 * from. Each channel is additive: every existing caller that doesn't pass
 * `inApp` keeps working exactly as before, email-only, and push is a no-op
 * for any recipient with no subscribed device (or when no VAPID keys are
 * configured at all, per §6.8's graceful-degradation rule).
 *
 * Deliberately generic: `notify(orgId, params)` looks up org members
 * matching `recipientRoles` and queues one email per match (unchanged
 * behavior), plus — when `inApp` is given — writes one `notifications` row
 * per match in the same call. Nothing here is Quotes-specific — future
 * modules (Invoices/Payments/Jobs) can call this same method for their own
 * "notify X about Y" needs without adding a new module.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly push: PushService,
  ) {}

  /**
   * Queues one notification email per active member of `orgId` whose role
   * is in `recipientRoles` (default `["owner"]`, preserving the exact
   * behavior every pre-S-10.11 caller relies on), and — when `inApp` is
   * given — writes one persisted `notifications` row per the same set of
   * recipients. Never throws — a failure to look up recipients, enqueue an
   * email, or write the in-app rows is logged and swallowed, exactly
   * matching `QuotesService.send()`'s own posture on its email-enqueue
   * call: the action that triggered a notification (an already-committed
   * public accept/view) must never be blocked or failed by this being
   * unable to notify anyone.
   */
  async notify(
    orgId: string,
    params: {
      subject: string;
      text: string;
      html?: string;
      recipientRoles?: string[];
      inApp?: { type: string; message: string; link?: string };
    },
  ): Promise<void> {
    const roles = params.recipientRoles ?? ["owner"];
    try {
      const recipients = await this.db
        .select({ userId: member.userId, email: user.email })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(and(eq(member.organizationId, orgId), inArray(member.role, roles), eq(member.isActive, true)));

      if (!recipients.length) {
        this.logger.warn(`No active member with role in [${roles.join(", ")}] found for org ${orgId} — notification "${params.subject}" was not sent to anyone`);
        return;
      }

      await Promise.all(
        recipients.map((recipient) =>
          this.queue.send(NOTIFY_EMAIL_QUEUE, {
            to: recipient.email,
            subject: params.subject,
            text: params.text,
            html: params.html,
          } satisfies NotifyEmailJobData),
        ),
      );

      if (params.inApp) {
        const { type, message, link } = params.inApp;
        await this.db.insert(notifications).values(
          recipients.map((recipient) => ({
            orgId,
            recipientUserId: recipient.userId,
            type,
            message,
            link: link ?? null,
          })),
        );

        if (this.push.isConfigured()) {
          await Promise.all(
            recipients.map((recipient) =>
              this.push.sendToUser(orgId, recipient.userId, { title: params.subject, body: message, link }),
            ),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to notify org ${orgId} ("${params.subject}")`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** `GET /notifications` — newest-first, org- and recipient-scoped. `unreadOnly` filters to `readAt IS NULL`. */
  async listRecent(orgId: string, userId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
    const conditions = [eq(notifications.orgId, orgId), eq(notifications.recipientUserId, userId)];
    if (options.unreadOnly) conditions.push(isNull(notifications.readAt));

    return this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(options.limit ?? 50);
  }

  /** `GET /notifications/unread-count` — a cheap count for the bell's badge, polled independently of the full list. */
  async unreadCount(orgId: string, userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
    return rows.length;
  }

  /**
   * `POST /notifications/:id/read` — scoped to `(orgId, recipientUserId)`
   * in the WHERE clause itself, not just an existence check beforehand, so
   * one user can never mark another's notification read (or one from a
   * different org) even given a guessed id. Idempotent: marking an
   * already-read notification read again is a no-op, not an error.
   */
  async markRead(orgId: string, userId: string, id: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId), eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
  }

  /** `POST /notifications/read-all` — marks every currently-unread notification for this (org, user) as read in one statement. */
  async markAllRead(orgId: string, userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.orgId, orgId), eq(notifications.recipientUserId, userId), isNull(notifications.readAt)));
  }
}
