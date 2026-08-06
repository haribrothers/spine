import { Controller, Delete, Get, Post, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { DemoDataService } from "./demo-data.service";

/**
 * Backs the onboarding "load demo data" option (welcome-step.tsx) and the
 * Settings "delete all demo data" action (settings/panes/data-pane.tsx).
 * `seed` is owner+staff (same bar as creating a contact/catalog item
 * manually); `deleteAll` is owner-only, matching SettingsController's own
 * "only the owner may change org-wide config" rule — bulk-deleting data is
 * at least as consequential as that.
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
  @OrgRoles(["owner", "staff"])
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
