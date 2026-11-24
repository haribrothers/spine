import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseInterceptors } from "@nestjs/common";
import {
  changeEmailSchema,
  changePasswordSchema,
  dashboardBasisSchema, dashboardLayoutSchema, favouriteReportsSchema,
  notificationPreferencesSchema,
  updateMeetingReminderLeadMinutesSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "@spine/shared";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import type { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { UsersService } from "./users.service";

/**
 * S-10.17 — Profile & Preferences. No @OrgRoles anywhere in this
 * controller: every route must be reachable regardless of role, including
 * Field, since this is self-service for one's own account, not an admin
 * surface. Deliberately separate from the Owner-gated org/teams area.
 */
/** The member's current organisation, for role defaults (the digest, D-093). */
const orgOf = (session: UserSession): string | null => (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
/** US-AUTH-17 — the session making this request. */
const sessionIdOf = (session: UserSession): string | null => (session.session as { id?: string }).id ?? null;

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getMe(@Session() session: UserSession) {
    return this.usersService.getMe(session.user.id, orgOf(session));
  }

  @Put("me")
  @UseInterceptors(IdempotencyInterceptor)
  async updateProfile(
    @Session() session: UserSession,
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    await this.usersService.updateProfile(session.user.id, fromNodeHeaders(request.headers), body);
    return this.usersService.getMe(session.user.id, orgOf(session));
  }

  @Put("me/password")
  @UseInterceptors(IdempotencyInterceptor)
  async changePassword(
    @Session() session: UserSession,
    @Req() request: Request,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    const signOutOthers = (body.signOutOthers ?? true) ? { userId: session.user.id, currentSessionId: sessionIdOf(session) } : null;
    await this.usersService.changePassword(fromNodeHeaders(request.headers), body.currentPassword, body.newPassword, signOutOthers);
    return { changed: true };
  }

  /** US-AUTH-18 — a new sign-in email, with the current password; the old address is told. */
  @Put("me/email")
  @UseInterceptors(IdempotencyInterceptor)
  async changeEmail(
    @Session() session: UserSession,
    @Req() request: Request,
    @Body(new ZodValidationPipe(changeEmailSchema)) body: z.infer<typeof changeEmailSchema>,
  ) {
    const from = { userAgent: request.headers["user-agent"] ?? null, ip: request.ip ?? null };
    return this.usersService.changeEmail(session.user.id, orgOf(session), body, from);
  }

  /** US-AUTH-17 — where this account is signed in. */
  @Get("me/sessions")
  async listSessions(@Session() session: UserSession) {
    return this.usersService.listSessions(session.user.id, sessionIdOf(session));
  }

  @Post("me/sessions/sign-out-others")
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async endOtherSessions(@Session() session: UserSession) {
    return this.usersService.endOtherSessions(session.user.id, sessionIdOf(session));
  }

  @Delete("me/sessions/:id")
  @UseInterceptors(IdempotencyInterceptor)
  async endSession(@Session() session: UserSession, @Param("id") id: string) {
    await this.usersService.endSession(session.user.id, id, sessionIdOf(session));
    return { ended: true };
  }

  @Put("me/preferences")
  @UseInterceptors(IdempotencyInterceptor)
  async updatePreferences(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(updatePreferencesSchema)) body: z.infer<typeof updatePreferencesSchema>,
  ) {
    await this.usersService.updatePreferences(session.user.id, body.themePreference);
    return this.usersService.getMe(session.user.id, orgOf(session));
  }

  @Get("me/dashboard-layout")
  async getDashboardLayout(@Session() session: UserSession) {
    return { layout: await this.usersService.getDashboardLayout(session.user.id) };
  }

  /** S-09.13 (dashboard v2) — any authenticated user edits their own dashboard widget order/visibility. Not org-scoped, not Owner-gated — same self-service reasoning as every other route in this controller. */
  @Put("me/dashboard-layout")
  @UseInterceptors(IdempotencyInterceptor)
  async updateDashboardLayout(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(dashboardLayoutSchema)) body: z.infer<typeof dashboardLayoutSchema>,
  ) {
    await this.usersService.setDashboardLayout(session.user.id, body);
    return { layout: body };
  }

  /** US-DASH-26 — Accrual or Cash for the dashboard's profit figures, kept with the layout on every device. */
  @Get("me/dashboard-basis")
  async getDashboardBasis(@Session() session: UserSession) {
    return { basis: await this.usersService.getDashboardBasis(session.user.id) };
  }

  @Put("me/dashboard-basis")
  @UseInterceptors(IdempotencyInterceptor)
  async updateDashboardBasis(@Session() session: UserSession, @Body(new ZodValidationPipe(dashboardBasisSchema)) body: z.infer<typeof dashboardBasisSchema>) {
    await this.usersService.setDashboardBasis(session.user.id, body.basis);
    return { basis: body.basis };
  }

  /** US-RPT-23 — the member's favourite reports, on every device. Self-service, like the dashboard layout. */
  @Get("me/favourite-reports")
  async getFavouriteReports(@Session() session: UserSession) {
    return { slugs: await this.usersService.getFavouriteReports(session.user.id) };
  }

  @Put("me/favourite-reports")
  @UseInterceptors(IdempotencyInterceptor)
  async updateFavouriteReports(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(favouriteReportsSchema)) body: z.infer<typeof favouriteReportsSchema>,
  ) {
    return { slugs: await this.usersService.setFavouriteReports(session.user.id, body.slugs) };
  }

  /** S-10.22 — personal override of the org's default meeting-reminder lead time; `meetingReminderLeadMinutes: null` clears back to "use org default". */
  @Put("me/meeting-reminder-lead-minutes")
  @UseInterceptors(IdempotencyInterceptor)
  async updateMeetingReminderLeadMinutes(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(updateMeetingReminderLeadMinutesSchema))
    body: z.infer<typeof updateMeetingReminderLeadMinutesSchema>,
  ) {
    await this.usersService.setMeetingReminderLeadMinutes(session.user.id, body.meetingReminderLeadMinutes);
    return this.usersService.getMe(session.user.id, orgOf(session));
  }

  /** US-NTF-14 — the daily digest: on or off, "Send at" (organisation time) and days. Self only. */
  @Put("me/notification-preferences")
  @UseInterceptors(IdempotencyInterceptor)
  async updateNotificationPreferences(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(notificationPreferencesSchema)) body: z.infer<typeof notificationPreferencesSchema>,
  ) {
    return this.usersService.setNotificationPreferences(session.user.id, orgOf(session), body);
  }
}
