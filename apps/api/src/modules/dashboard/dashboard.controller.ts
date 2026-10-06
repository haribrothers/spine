import { BadRequestException, Controller, Get, Inject, Post, Query, UseInterceptors } from "@nestjs/common";
import { periodLabel, sharePercent, TOP_EXPENSE_PERIODS, type ReturnPeriod, type TaxPeriod, type TopExpensePeriod, type TopExpenses } from "@spine/shared";
import { orgClock } from "../../common/org-clock";
import { AnalysisReportsService } from "../reports/analysis-reports.service";
import { ReportsService } from "../reports/reports.service";
import { SettingsService } from "../org/settings.service";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getMemberRole } from "../../auth/capability.util";
import type { Database } from "../../db/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { taxPayments } from "../../db/schema";
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
    private readonly analysis: AnalysisReportsService,
    private readonly settings: SettingsService,
    private readonly reports: ReportsService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /**
   * US-DASH-25 (D-160) — tax for the current month or quarter (Settings ›
   * Tax › "Return period"): collected, input tax and net payable as the
   * Tax Summary works them out, and what's been paid for the period.
   */
  @Get("tax-period")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async taxPeriod(@Session() session: UserSession): Promise<TaxPeriod> {
    const orgId = requireOrgId(session);
    const returnPeriod: ReturnPeriod = (await this.settings.get<{ returnPeriod?: ReturnPeriod }>(orgId, "tax_profile"))?.returnPeriod ?? "monthly";
    const today = orgClock().date;
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const first = returnPeriod === "quarterly" ? Math.floor((m - 1) / 3) * 3 + 1 : m;
    const last = returnPeriod === "quarterly" ? first + 2 : m;
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${y}-${pad(first)}-01`;
    const to = `${y}-${pad(last)}-${pad(new Date(Date.UTC(y, last, 0)).getUTCDate())}`;
    const summary = await this.reports.taxSummary(orgId, from, to);
    const [paid] = await this.db
      .select({ amount: sql<string | null>`sum(${taxPayments.amount})` })
      .from(taxPayments)
      .where(
        and(
          eq(taxPayments.orgId, orgId),
          eq(taxPayments.kind, "payment"),
          isNull(taxPayments.deletedAt),
          sql`coalesce(${taxPayments.periodTo}, ${taxPayments.date}) >= ${from}::date`,
          sql`coalesce(${taxPayments.periodFrom}, ${taxPayments.date}) <= ${to}::date`,
        ),
      );
    return {
      returnPeriod,
      from,
      to,
      label: returnPeriod === "monthly" ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : periodLabel(from, to),
      collected: summary.taxCollected,
      input: summary.taxPaid,
      net: summary.netTaxPayable,
      paid: paid?.amount ? BigInt(paid.amount).toString() : null,
    };
  }

  /**
   * US-DASH-22 (D-160) — the five largest expense accounts this month,
   * quarter or financial year (Settings › Financial year), with "Other";
   * the same figures as Expenses by category.
   */
  @Get("top-expenses")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async topExpenses(@Session() session: UserSession, @Query("period") period: string = "month"): Promise<TopExpenses> {
    if (!(TOP_EXPENSE_PERIODS as readonly string[]).includes(period)) throw new BadRequestException("Choose This month, This quarter or This financial year.");
    const orgId = requireOrgId(session);
    const to = orgClock().date;
    const [y, m] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
    const pad = (n: number) => String(n).padStart(2, "0");
    let from = `${y}-${pad(m)}-01`;
    if (period === "quarter") from = `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`;
    if (period === "year") {
      const start = (await this.settings.get<{ month: number; day: number }>(orgId, "financial_year_start")) ?? { month: 1, day: 1 };
      const thisYear = `${y}-${pad(start.month)}-${pad(start.day)}`;
      from = thisYear <= to ? thisYear : `${y - 1}-${pad(start.month)}-${pad(start.day)}`;
    }
    const report = await this.analysis.expensesByCategory(orgId, from, to);
    const total = BigInt(report.total);
    const top = report.rows.slice(0, 5);
    const rest = report.rows.slice(5).reduce((s, r) => s + BigInt(r.amount), 0n);
    return {
      period: period as TopExpensePeriod,
      from,
      to,
      total: report.total,
      rows: top.map((r) => ({ accountId: r.accountId, code: r.code, name: r.name, amount: r.amount, percent: r.percentOfTotal })),
      other: report.rows.length > 5 ? { amount: rest.toString(), percent: sharePercent(rest, total) } : null,
    };
  }

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

  /** US-DASH-24 (D-160) — completed milestones not invoiced and approved billable expenses not billed. */
  @Get("unbilled")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_receivables")
  async getUnbilled(@Session() session: UserSession) {
    return this.dashboardService.unbilled(requireOrgId(session));
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
