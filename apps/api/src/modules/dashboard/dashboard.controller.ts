import { Controller, Get, Inject, Post, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getMemberRole } from "../../auth/capability.util";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
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
  constructor(
    private readonly dashboardService: DashboardService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** US-ONB-12 — setup is the Owner's job: Staff and Field always get `{ visible: false }`. */
  @Get("checklist")
  async getChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    if ((await getMemberRole(this.db, orgId, session.user.id)) !== "owner") return { visible: false };
    return { visible: true, ...(await this.dashboardService.getSetupChecklist(orgId)) };
  }

  /** Dismissing hides the card for every Owner in the organisation, so only Owners can do it (US-ONB-12). */
  @Post("checklist/dismiss")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async dismissChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    await this.dashboardService.dismissChecklist(orgId);
    return { ok: true };
  }
}
