import { Body, Controller, Delete, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { NotificationsService } from "./notifications.service";
import { PushService, pushSubscriptionSchema } from "./push.service";

/**
 * PRD S-10.11 — every authenticated org member reads their OWN
 * notifications; no `@OrgRoles` restriction beyond the implicit "must have
 * a session and be a member of the org" every route already requires (via
 * `requireOrgId`). Unlike `QuotesController`, there's no role gate here on
 * purpose: which users RECEIVE a given notification is decided once, at
 * write time, by `NotificationsService.notify()`'s `recipientRoles`
 * (e.g. quote events only ever write rows for owner+staff, matching
 * `QuotesController`'s own access) — by the time a row exists, its
 * recipient already earned the right to see it, so read access just needs
 * "is this actually your row," enforced in every `NotificationsService`
 * query via `recipientUserId = session.user.id` in the WHERE clause itself.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get()
  async list(@Session() session: UserSession, @Query("unreadOnly") unreadOnly?: string, @Query("limit") limit?: string) {
    const orgId = requireOrgId(session);
    return this.notifications.listRecent(orgId, session.user.id, {
      unreadOnly: unreadOnly === "true",
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("unread-count")
  async unreadCount(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    const count = await this.notifications.unreadCount(orgId, session.user.id);
    return { count };
  }

  @Post(":id/read")
  @UseInterceptors(IdempotencyInterceptor)
  async markRead(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.notifications.markRead(orgId, session.user.id, id);
    return { id };
  }

  @Post("read-all")
  @UseInterceptors(IdempotencyInterceptor)
  async markAllRead(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    await this.notifications.markAllRead(orgId, session.user.id);
    return { ok: true };
  }

  /**
   * PRD S-10.12 — the web app's subscribe UI hides itself (or shows
   * "not configured") when `configured` is false, per the acceptance
   * highlight that push must degrade gracefully with no VAPID keys set.
   */
  @Get("push/public-key")
  pushPublicKey() {
    return { configured: this.push.isConfigured(), publicKey: this.push.getPublicKey() };
  }

  @Get("push/subscriptions")
  async listPushSubscriptions(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.push.listForUser(orgId, session.user.id);
  }

  @Post("push/subscribe")
  @UseInterceptors(IdempotencyInterceptor)
  async subscribePush(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = pushSubscriptionSchema.parse(body);
    await this.push.subscribe(orgId, session.user.id, input);
    return { ok: true };
  }

  @Delete("push/subscribe")
  async unsubscribePush(@Session() session: UserSession, @Query("endpoint") endpoint: string) {
    const orgId = requireOrgId(session);
    await this.push.unsubscribe(orgId, session.user.id, endpoint);
    return { ok: true };
  }
}
