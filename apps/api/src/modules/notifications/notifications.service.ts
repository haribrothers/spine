import { ownedByOffModule } from "@spine/shared";
import { loadModules } from "../../common/modules";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, notifications, user } from "../../db/schema";
import { EmailLogService, type LoggedJobData } from "../email/email-log.service";
import { PushService } from "./push.service";

export const NOTIFY_EMAIL_QUEUE = "notify-email";

export interface NotifyEmailJobData extends LoggedJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** US-NTF-11 — present on jobs queued since the branded layout; the worker renders the email from these. */
  orgId?: string;
  /** The in-app link (e.g. `/jobs/<id>`), used for the email's button. */
  link?: string;
}

/** US-SET-27 — the record a notification is about, from its link ("/jobs/<id>" → a job), for the email log. */
const LINKED_RECORDS: Record<string, string> = {
  quotes: "quote",
  invoices: "invoice",
  "credit-notes": "credit_note",
  payments: "payment",
  contacts: "contact",
  jobs: "job",
  "vendor-bills": "vendor_bill",
  expenses: "expense",
  meetings: "meeting",
};
export function recordOfLink(link: string | null | undefined): { entityType?: string; entityId?: string } {
  const match = link?.match(/^\/([a-z-]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const type = match ? LINKED_RECORDS[match[1]!] : undefined;
  return type ? { entityType: type, entityId: match![2]! } : {};
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
    private readonly push: PushService,
    private readonly emailLog: EmailLogService,
  ) {}

  /**
   * Queues one notification email per active member of `orgId` matched by
   * `recipientRoles` and/or `recipientUserIds`, and — when `inApp` is given
   * — writes one persisted `notifications` row per the same set of
   * recipients. Never throws — a failure to look up recipients, enqueue an
   * email, or write the in-app rows is logged and swallowed, exactly
   * matching `QuotesService.send()`'s own posture on its email-enqueue
   * call: the action that triggered a notification (an already-committed
   * public accept/view) must never be blocked or failed by this being
   * unable to notify anyone.
   *
   * Recipient resolution (order matters — this is the one place a subtle
   * bug would silently over- or under-notify):
   *   - Neither `recipientRoles` nor `recipientUserIds` given → `["owner"]`,
   *     preserving the exact default every pre-S-10.20 caller relies on.
   *   - Only `recipientRoles` given → unchanged existing behavior exactly.
   *   - Only `recipientUserIds` given → recipients are EXACTLY those user
   *     ids — deliberately NOT unioned with the `["owner"]` default, or an
   *     Owner who isn't one of the named recipients would silently receive
   *     every targeted notification (e.g. a meeting-invite meant for one
   *     Staff member).
   *   - Both given → the union (role match OR user id match).
   */
  async notify(
    orgId: string,
    params: {
      subject: string;
      text: string;
      html?: string;
      recipientRoles?: string[];
      recipientUserIds?: string[];
      /** Members never notified this time, e.g. the person the event is about when they get their own message (US-MOB-22). */
      excludeUserIds?: string[];
      /** `detail` is the second line under the message (the phone's list, US-MOB-22). */
      inApp?: { type: string; message: string; detail?: string; link?: string };
    },
  ): Promise<void> {
    const { recipientRoles, recipientUserIds, excludeUserIds } = params;
    // US-SET-24: nothing about a switched-off module is sent.
    if (params.inApp && ownedByOffModule(await loadModules(this.db, orgId), "notifications", params.inApp.type)) return;
    const useDefaultRole = !recipientRoles && !recipientUserIds;
    const roleFilter = useDefaultRole ? ["owner"] : recipientRoles;
    try {
      const matchers = [
        ...(roleFilter ? [inArray(member.role, roleFilter)] : []),
        ...(recipientUserIds ? [inArray(member.userId, recipientUserIds)] : []),
      ];
      if (!matchers.length) {
        this.logger.warn(`notify() called for org ${orgId} with no recipientRoles or recipientUserIds — nothing to do`);
        return;
      }

      const recipients = await this.db
        .select({ userId: member.userId, email: user.email })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
          and(
            eq(member.organizationId, orgId),
            eq(member.isActive, true),
            or(...matchers),
            excludeUserIds?.length ? notInArray(member.userId, excludeUserIds) : undefined,
          ),
        );

      if (!recipients.length) {
        this.logger.warn(`No active member matched roles=[${(roleFilter ?? []).join(", ")}] userIds=[${(recipientUserIds ?? []).join(", ")}] for org ${orgId} — notification "${params.subject}" was not sent to anyone`);
        return;
      }

      const record = recordOfLink(params.inApp?.link);
      await Promise.all(
        recipients.map((recipient) =>
          this.emailLog.enqueue(
            NOTIFY_EMAIL_QUEUE,
            {
              to: recipient.email,
              subject: params.subject,
              text: params.text,
              orgId,
              link: params.inApp?.link,
            } satisfies NotifyEmailJobData,
            { orgId, kind: "notification", toAddress: recipient.email, subject: params.subject, ...record },
          ),
        ),
      );

      if (params.inApp) {
        const { type, message, detail, link } = params.inApp;
        await this.db.insert(notifications).values(
          recipients.map((recipient) => ({
            orgId,
            recipientUserId: recipient.userId,
            type,
            message,
            detail: detail ?? null,
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
