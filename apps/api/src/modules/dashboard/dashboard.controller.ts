import { Controller, Get, Inject, Post, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getMemberRole } from "../../auth/capability.util";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { DashboardService } from "./dashboard.service";
import { AttentionService } from "./attention.service";
import { KpiService } from "./kpi.service";

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
    private readonly attention: AttentionService,
    private readonly kpis: KpiService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** US-ONB-12 — setup is the Owner's job: Staff and Field always get `{ visible: false }`. */
  @Get("checklist")
  async getChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    if ((await getMemberRole(this.db, orgId, session.user.id)) !== "owner") return { visible: false };
    return { visible: true, ...(await this.dashboardService.getSetupChecklist(orgId)) };
  }

  /**
   * US-DASH-12 — "Needs your attention": the open items waiting on this
   * member, filtered server-side by their capabilities and ownership.
   */
  @Get("attention")
  async getAttention(@Session() session: UserSession) {
    return this.attention.list(requireOrgId(session), session.user.id);
  }

  /** US-DASH-14 — the key figures this member may see, each with 8 weeks and last month. */
  @Get("kpis")
  async getKpis(@Session() session: UserSession) {
    return this.kpis.list(requireOrgId(session), session.user.id);
  }

  /** Dismissing hides the card for every Owner in the organisation, so only Owners can do it (US-ONB-12). */
  /** US-DASH-20 — retention held, by job (1150 Retention Receivable). */
  @Get("retention")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_receivables")
  async getRetention(@Session() session: UserSession) {
    return this.dashboardService.retentionHeld(requireOrgId(session));
  }

  @Post("checklist/dismiss")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async dismissChecklist(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    await this.dashboardService.dismissChecklist(orgId);
    return { ok: true };
  }
}
