import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { requireOrgId } from "../org/settings.controller";
import { MobileTodayService, TODAY_PERIODS, type TodayPeriod } from "./mobile-today.service";

/**
 * Phase 5 — reads made for the field app. Any member: everything here is
 * scoped to the caller's own crews and expenses, so there's nothing to gate.
 */
@Controller("mobile")
export class MobileController {
  constructor(private readonly today: MobileTodayService) {}

  /** US-MOB-03 — Today's gauge and KPI cards for "This week", "This month" or "This year". */
  @Get("today")
  async summary(@Session() session: UserSession, @Query("period") period?: string) {
    const orgId = requireOrgId(session);
    const chosen = (period ?? "month") as TodayPeriod;
    if (!TODAY_PERIODS.includes(chosen)) throw new BadRequestException("Choose a period: week, month or year.");
    return this.today.summary(orgId, session.user.id, chosen);
  }
}
