import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { changePasswordSchema, dashboardLayoutSchema, updatePreferencesSchema, updateProfileSchema } from "@spine/shared";
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
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getMe(@Session() session: UserSession) {
    return this.usersService.getMe(session.user.id);
  }

  @Put("me")
  async updateProfile(
    @Session() session: UserSession,
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.usersService.updateProfile(session.user.id, fromNodeHeaders(request.headers), body);
  }

  @Put("me/password")
  async changePassword(
    @Req() request: Request,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    await this.usersService.changePassword(fromNodeHeaders(request.headers), body.currentPassword, body.newPassword);
    return { changed: true };
  }

  @Put("me/preferences")
  async updatePreferences(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(updatePreferencesSchema)) body: z.infer<typeof updatePreferencesSchema>,
  ) {
    return this.usersService.updatePreferences(session.user.id, body.themePreference);
  }

  @Get("me/dashboard-layout")
  async getDashboardLayout(@Session() session: UserSession) {
    return { layout: await this.usersService.getDashboardLayout(session.user.id) };
  }

  /** S-09.13 (dashboard v2) — any authenticated user edits their own dashboard widget order/visibility. Not org-scoped, not Owner-gated — same self-service reasoning as every other route in this controller. */
  @Put("me/dashboard-layout")
  async updateDashboardLayout(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(dashboardLayoutSchema)) body: z.infer<typeof dashboardLayoutSchema>,
  ) {
    await this.usersService.setDashboardLayout(session.user.id, body);
    return { layout: body };
  }
}
