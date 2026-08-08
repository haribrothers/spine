import { Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { DashboardService } from "./dashboard.service";

/**
 * No `@OrgRoles` restriction on either route — every authenticated org
 * member sees the same setup checklist and can dismiss it. `dismiss` is
 * deliberately its own endpoint rather than reusing `PUT /org/settings/:key`
 * (owner-only, per that controller's own comment) — see
 * `DashboardService.dismissChecklist`'s comment for why.
 */
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("checklist")
  async getChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.dashboardService.getSetupChecklist(orgId);
  }

  @Post("checklist/dismiss")
  @UseInterceptors(IdempotencyInterceptor)
  async dismissChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    await this.dashboardService.dismissChecklist(orgId);
    return { ok: true };
  }
}
