import { Controller, Delete, Get, Post, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { DemoDataService } from "./demo-data.service";

/**
 * Backs the onboarding "load demo data" option (welcome-step.tsx) and the
 * Settings "delete all demo data" action (settings/panes/data-pane.tsx).
 * Both `seed` and `deleteAll` are Owner-only (US-OPS-20): loading or
 * removing a whole demo dataset changes the organisation for everyone,
 * the same bar as SettingsController's "only the owner may change
 * org-wide config" rule.
 */
@Controller("demo-data")
export class DemoDataController {
  constructor(private readonly demoDataService: DemoDataService) {}

  @Get("status")
  async status(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.demoDataService.status(orgId);
  }

  @Post("seed")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async seed(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.demoDataService.seed(orgId, session.user.id);
  }

  @Delete()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async deleteAll(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.demoDataService.deleteAll(orgId, session.user.id);
  }
}
