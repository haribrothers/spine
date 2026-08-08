import { Inject, Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { pushSubscriptions } from "../../db/schema";

/**
 * `endpoint` is later used as the literal HTTP target of an outbound,
 * server-issued `webpush.sendNotification` call (carrying VAPID auth
 * headers) — an unvalidated string here is a direct SSRF vector against
 * internal infra/cloud metadata endpoints. Restricting to `https://` (real
 * push services — FCM, Mozilla autopush, etc. — are always https) rules
 * out `http://169.254.169.254/...`-style targets and non-http schemes.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/**
 * PRD S-10.12 — thin Web Push wrapper, deliberately mirroring
 * `EmailService`'s exact "optional, graceful degradation" shape:
 * `isConfigured()` lets a caller skip straight past sending when no VAPID
 * keypair is set (per §6.8's "app boots with only 3 required env vars"
 * rule) rather than every call site re-checking env vars itself.
 *
 * Unlike `EmailService.send()`, `sendToUser` never throws past its own
 * per-subscription try/catch — a push failure must not block or fail the
 * business event that triggered it, matching `NotificationsService.notify()`'s
 * own never-throw posture on its email channel. A 404/410 from the push
 * service means the browser unsubscribed or the endpoint expired; that
 * subscription row is deleted so it stops being retried forever.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private configured = false;

  constructor(@Inject(DATABASE) private readonly db: Database) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getPublicKey(): string | null {
    return this.configured ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
  }

  /**
   * Upserts on `endpoint` (a browser re-subscribing without first
   * unsubscribing produces the same endpoint again), but only ever
   * overwrites a row this exact (orgId, userId) already owns — an
   * `endpoint` collision with a DIFFERENT user's existing row is rejected
   * rather than silently reassigning that subscription's ownership, since
   * `endpoint` is client-supplied and two callers could otherwise collide
   * on a guessed or replayed value.
   */
  async subscribe(orgId: string, userId: string, sub: PushSubscriptionInput): Promise<void> {
    const [existing] = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
    if (existing && (existing.orgId !== orgId || existing.userId !== userId)) {
      throw new ForbiddenException("This push subscription is already registered to a different account.");
    }

    await this.db
      .insert(pushSubscriptions)
      .values({
        orgId,
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
  }

  /** Scoped to `(orgId, userId)` so one user can't unsubscribe another's device by guessing an endpoint. */
  async unsubscribe(orgId: string, userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.orgId, orgId), eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async listForUser(orgId: string, userId: string): Promise<{ endpoint: string }[]> {
    return this.db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.orgId, orgId), eq(pushSubscriptions.userId, userId)));
  }

  /** Sends to every device of `userId`; never throws — logs and continues past individual subscription failures. */
  async sendToUser(orgId: string, userId: string, payload: { title: string; body: string; link?: string }): Promise<void> {
    if (!this.configured) return;
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.orgId, orgId), eq(pushSubscriptions.userId, userId)));

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          } else {
            this.logger.error(`Push send failed for user ${userId} (endpoint ${sub.endpoint})`, err instanceof Error ? err.stack : String(err));
          }
        }
      }),
    );
  }
}
