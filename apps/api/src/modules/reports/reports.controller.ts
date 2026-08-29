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
 * owner+staff, the single `dashboard.view` capability that used to gate
 * dashboard-summary/receivables/payables/job-profitability together is
 * split into four independent capabilities —
 * `reports.view_dashboard_summary`, `reports.view_receivables`,
 * `reports.view_payables`, `reports.view_job_profitability` — so an Owner
 * can grant a Team visibility into one report without the others (e.g.
 * receivables without payables). `ledger.view` similarly gates
 * `account-drilldown` for Staff, alongside its existing `@OrgRoles(["owner"])`
 * floor (Owner always passes regardless of any grant). P&L, Balance Sheet,
 * and revenue-trend stay `@OrgRoles(["owner"])` with no capability bypass
 * at all — genuinely Owner-only, not Team-configurable.
 */
@Controller("reports")
@OrgRoles(["owner", "staff"])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** S-09.10 — the real dashboard summary. */
  @Get("dashboard-summary")
  @RequireCapability("reports.view_dashboard_summary")
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

  /** S-09.12 (dashboard v2) — "invoices due this week" widget. Read-only across every invoice, same unconditional-GET convention as every other list/report route in this codebase. */
  @Get("invoices-due-this-week")
  async invoicesDueThisWeek(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.invoicesDueThisWeek(orgId);
  }

  @Get("receivables")
  @RequireCapability("reports.view_receivables")
  async receivables(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.receivables(orgId);
  }

  /** S-07.7 — the AP-side mirror of receivables above; its own independent capability, since Staff already manages vendor bills/payments end-to-end via the `vendor_bills.*`/`vendor_payments.*` capabilities and reasonably needs to see what's due, but that doesn't imply visibility into who owes THE ORG money. */
  @Get("payables")
  @RequireCapability("reports.view_payables")
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

  /** S-09.4 — drill-down behind a P&L/Balance Sheet figure. `@OrgRoles(["owner"])` is a floor (Owner always passes); `ledger.view` additionally lets a Staff user in a granted Team reach this too, even though P&L/Balance Sheet themselves stay Owner-only with no bypass — drilling into raw journal entries is a narrower, more literal "view the ledger" grant than seeing the full financial statements. */
  @Get("account-drilldown")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("ledger.view")
  async accountDrilldown(
    @Session() session: UserSession,
    @Query("accountId") accountId: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    const orgId = requireOrgId(session);
    return this.reportsService.accountDrilldown(orgId, accountId, from, to);
  }

  /** S-09.6 — all-jobs profitability summary; its own independent capability, not Owner-only, since Staff who can see jobs already sees per-job costing on the job detail page. */
  @Get("job-profitability")
  @RequireCapability("reports.view_job_profitability")
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
  @RequireCapability("reports.view_receivables")
  async exportReceivables(@Session() session: UserSession, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.receivables(orgId);
    const rows = report.invoices.map((i) => [i.number, i.contactName, i.currency, i.dueDate, i.totalAmount, i.balanceDue, i.daysOverdue, i.bucket]);
    sendCsv(res, `receivables-${report.asOf}.csv`, toCsv(["Invoice #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  @Get("payables/export.csv")
  @RequireCapability("reports.view_payables")
  async exportPayables(@Session() session: UserSession, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.payables(orgId);
    const rows = report.bills.map((b) => [b.billNumber, b.contactName, b.currency, b.dueDate, b.totalAmount, b.balanceDue, b.daysOverdue, b.bucket]);
    sendCsv(res, `payables-${report.asOf}.csv`, toCsv(["Bill #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  @Get("job-profitability/export.csv")
  @RequireCapability("reports.view_job_profitability")
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
