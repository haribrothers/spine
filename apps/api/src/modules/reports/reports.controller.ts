import { Controller, Get, Query, Res } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { toCsv } from "../../common/csv";
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
 * (and, added in Phase 4 Stage 3, payables/job profitability) is what Staff
 * can be granted. P&L, Balance Sheet, and the account drill-down behind
 * them are `@OrgRoles(["owner"])` per-route below — Owner-only with no
 * capability escape hatch, matching that description literally.
 */
@Controller("reports")
@OrgRoles(["owner", "staff"])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** S-09.10 — the real dashboard summary; same `dashboard.view` gate as everything else Staff can see. */
  @Get("dashboard-summary")
  @RequireCapability("dashboard.view")
  async dashboardSummary(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.dashboardSummary(orgId);
  }

  /** S-09.11 (dashboard v2) — revenue trend chart. Owner-only, no capability bypass — same gate as P&L/Balance Sheet, since this is derived from the same income-account journal history those reports summarize. */
  @Get("revenue-trend")
  @OrgRoles(["owner"])
  async revenueTrend(@Session() session: UserSession, @Query("months") months?: string) {
    const orgId = requireOrgId(session);
    const parsed = months ? Number(months) : 12;
    const safeMonths = parsed === 3 || parsed === 6 || parsed === 12 ? parsed : 12;
    return this.reportsService.revenueTrend(orgId, safeMonths);
  }

  /** S-09.12 (dashboard v2) — "invoices due this week" widget. Same capability invoice-management already requires elsewhere. */
  @Get("invoices-due-this-week")
  @RequireCapability("invoices.manage")
  async invoicesDueThisWeek(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.invoicesDueThisWeek(orgId);
  }

  @Get("receivables")
  @RequireCapability("dashboard.view")
  async receivables(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.receivables(orgId);
  }

  /** S-07.7 — the AP-side mirror of receivables above; same `dashboard.view` gate, since Staff already manages vendor bills/payments end-to-end via `purchases.manage` and reasonably needs to see what's due. */
  @Get("payables")
  @RequireCapability("dashboard.view")
  async payables(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.payables(orgId);
  }

  /** S-09.2 — Owner-only per this controller's own doc comment. */
  @Get("profit-and-loss")
  @OrgRoles(["owner"])
  async profitAndLoss(@Session() session: UserSession, @Query("from") from: string, @Query("to") to: string) {
    const orgId = requireOrgId(session);
    return this.reportsService.profitAndLoss(orgId, from, to);
  }

  /** S-09.3 — Owner-only, same reasoning as profitAndLoss above. */
  @Get("balance-sheet")
  @OrgRoles(["owner"])
  async balanceSheet(@Session() session: UserSession, @Query("asOf") asOf: string) {
    const orgId = requireOrgId(session);
    return this.reportsService.balanceSheet(orgId, asOf);
  }

  /** S-09.4 — drill-down behind a P&L/Balance Sheet figure; Owner-only, matching those two reports' own gate (a Staff user without P&L access shouldn't be able to reach its underlying entries via this route either). */
  @Get("account-drilldown")
  @OrgRoles(["owner"])
  async accountDrilldown(
    @Session() session: UserSession,
    @Query("accountId") accountId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    const orgId = requireOrgId(session);
    return this.reportsService.accountDrilldown(orgId, accountId, from, to);
  }

  /** S-09.6 — all-jobs profitability summary; same `dashboard.view` gate as receivables/payables, not Owner-only, since Staff with `jobs.update_milestones` already sees per-job costing on the job detail page. */
  @Get("job-profitability")
  @RequireCapability("dashboard.view")
  async jobProfitability(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.jobProfitability(orgId);
  }

  /**
   * S-09.7 — "export any report to CSV." One route per report rather than
   * a single generic `?report=x` dispatcher: each report has a genuinely
   * different row shape (P&L's two sections, Balance Sheet's three,
   * receivables/payables' aging columns, job profitability's margin
   * columns), so a shared CSV *writer* (`toCsv`) is reused but the
   * column mapping stays per-report and explicit. Gates mirror each
   * report's own JSON endpoint exactly — CSV is a rendering of the same
   * data, not a separate permission surface.
   */
  @Get("profit-and-loss/export.csv")
  @OrgRoles(["owner"])
  async exportProfitAndLoss(@Session() session: UserSession, @Query("from") from: string, @Query("to") to: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.profitAndLoss(orgId, from, to);
    const rows = [
      ...report.income.map((l) => ["Income", l.code, l.name, l.amount]),
      ["Income", "", "Total income", report.totalIncome],
      ...report.expenses.map((l) => ["Expense", l.code, l.name, l.amount]),
      ["Expense", "", "Total expenses", report.totalExpenses],
      ["", "", "Net profit", report.netProfit],
    ];
    sendCsv(res, `profit-and-loss-${from}-to-${to}.csv`, toCsv(["Section", "Code", "Account", "Amount"], rows));
  }

  @Get("balance-sheet/export.csv")
  @OrgRoles(["owner"])
  async exportBalanceSheet(@Session() session: UserSession, @Query("asOf") asOf: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.balanceSheet(orgId, asOf);
    const rows = [
      ...report.assets.map((l) => ["Asset", l.code, l.name, l.amount]),
      ["Asset", "", "Total assets", report.totalAssets],
      ...report.liabilities.map((l) => ["Liability", l.code, l.name, l.amount]),
      ["Liability", "", "Total liabilities", report.totalLiabilities],
      ...report.equity.map((l) => ["Equity", l.code, l.name, l.amount]),
      ["Equity", "", "Total equity", report.totalEquity],
      ["", "", "Total liabilities + equity", report.totalLiabilitiesAndEquity],
    ];
    sendCsv(res, `balance-sheet-${asOf}.csv`, toCsv(["Section", "Code", "Account", "Amount"], rows));
  }

  @Get("receivables/export.csv")
  @RequireCapability("dashboard.view")
  async exportReceivables(@Session() session: UserSession, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.receivables(orgId);
    const rows = report.invoices.map((i) => [i.number, i.contactName, i.currency, i.dueDate, i.totalAmount, i.balanceDue, i.daysOverdue, i.bucket]);
    sendCsv(res, `receivables-${report.asOf}.csv`, toCsv(["Invoice #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  @Get("payables/export.csv")
  @RequireCapability("dashboard.view")
  async exportPayables(@Session() session: UserSession, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.payables(orgId);
    const rows = report.bills.map((b) => [b.billNumber, b.contactName, b.currency, b.dueDate, b.totalAmount, b.balanceDue, b.daysOverdue, b.bucket]);
    sendCsv(res, `payables-${report.asOf}.csv`, toCsv(["Bill #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  @Get("job-profitability/export.csv")
  @RequireCapability("dashboard.view")
  async exportJobProfitability(@Session() session: UserSession, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.jobProfitability(orgId);
    const rows = report.jobs.map((j) => [j.name, j.status, j.currency, j.contractValueAmount, j.revenue, j.cost, j.margin, j.marginPct ?? ""]);
    sendCsv(res, "job-profitability.csv", toCsv(["Job", "Status", "Currency", "Contract value", "Revenue", "Cost", "Margin", "Margin %"], rows));
  }
}

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
