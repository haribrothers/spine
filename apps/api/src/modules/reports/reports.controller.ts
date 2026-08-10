import { Controller, Get } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { requireOrgId } from "../org/settings.controller";
import { ReportsService } from "./reports.service";

/**
 * `@OrgRoles(["owner", "staff"])` at the class level — Field never reaches
 * any financial report, per PRD §S-11.8 ("mobile hides all financial
 * reports") and CLAUDE.md's own restatement of that rule. Within
 * owner+staff, `@RequireCapability("dashboard.view")` further gates Staff
 * on the Team-configurable grant whose own label is literally "View
 * dashboard & reports" and whose description calls out "Receivables ...
 * P&L/balance sheet stay Owner-only regardless of this grant" — receivables
 * is the one financial report Staff can be granted, so this is the correct
 * capability rather than inventing a new `reports.view` one. Owner always
 * passes regardless of Team grants, same as every other capability check.
 */
@Controller("reports")
@OrgRoles(["owner", "staff"])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("receivables")
  @RequireCapability("dashboard.view")
  async receivables(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.receivables(orgId);
  }
}
