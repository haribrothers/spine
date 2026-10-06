import { analysisQuerySchema, balanceSheetQuerySchema, cashFlowQuerySchema, profitAndLossQuerySchema, TOO_MANY_MONTHS, dayBookQuerySchema, generalLedgerQuerySchema, toDecimalString } from "@spine/shared";
import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { toCsv, sendCsv } from "../../common/csv";
import { requireOrgId } from "../org/settings.controller";
import { ReportsService, type JobProfitabilityStatus } from "./reports.service";
import { LedgerIntegrityService } from "./ledger-integrity.service";
import { AnalysisReportsService } from "./analysis-reports.service";
import { CashFlowService } from "./cash-flow.service";
import { LedgerReportsService } from "./ledger-reports.service";

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
  constructor(
    private readonly reportsService: ReportsService,
    private readonly ledgerIntegrityService: LedgerIntegrityService,
    private readonly ledgerReports: LedgerReportsService,
    private readonly cashFlow: CashFlowService,
    private readonly analysis: AnalysisReportsService,
  ) {}

  private analysisRange(query: unknown) {
    const parsed = analysisQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return parsed.data;
  }

  /** US-RPT-28 — each customer's sales, tax and total, net of credit notes. Owner, or `reports.view_financial_statements`. */
  @Get("sales-by-customer")
  @RequireCapability("reports.view_financial_statements")
  async salesByCustomer(@Session() session: UserSession, @Query() query: unknown) {
    const { from, to } = this.analysisRange(query);
    return this.analysis.salesByCustomer(requireOrgId(session), from, to);
  }

  /** US-RPT-28 — quantity, sales and average price per catalogue item. Owner, or `reports.view_financial_statements`. */
  @Get("sales-by-item")
  @RequireCapability("reports.view_financial_statements")
  async salesByItem(@Session() session: UserSession, @Query() query: unknown) {
    const { from, to } = this.analysisRange(query);
    return this.analysis.salesByItem(requireOrgId(session), from, to);
  }

  /** US-RPT-26 — where cash came from and where it went, indirect method. Owner, or `reports.view_financial_statements`. */
  @Get("cash-flow")
  @RequireCapability("reports.view_financial_statements")
  async cashFlowStatement(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = cashFlowQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    if (parsed.data.from > parsed.data.to) throw new BadRequestException("Choose a From date on or before the To date.");
    return this.cashFlow.report(requireOrgId(session), parsed.data.from, parsed.data.to);
  }

  /** US-RPT-24 — every account's opening balance, entries and closing balance; paged by account. Owner, or `ledger.view`. */
  @Get("general-ledger")
  @RequireCapability("ledger.view")
  async generalLedger(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = generalLedgerQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return this.ledgerReports.generalLedger(requireOrgId(session), parsed.data);
  }

  /** US-RPT-25 — every journal entry in date order, optionally one kind of source. Owner, or `ledger.view`. */
  @Get("day-book")
  @RequireCapability("ledger.view")
  async dayBook(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = dayBookQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return this.ledgerReports.dayBook(requireOrgId(session), parsed.data);
  }

  /** S-09.10 — the real dashboard summary. */
  @Get("dashboard-summary")
  @RequireCapability("reports.view_dashboard_summary")
  async dashboardSummary(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.dashboardSummary(orgId);
  }

  /** US-DASH-15 — money received and spent per month, from the cash and bank accounts. */
  @Get("money-in-out")
  @RequireCapability("reports.view_dashboard_summary")
  async moneyInOut(@Session() session: UserSession, @Query("months") months?: string) {
    const n = months === "3" ? 3 : months === "6" ? 6 : 12;
    return this.reportsService.moneyInOut(requireOrgId(session), n);
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

  /** S-09.12 (dashboard v2) — "invoices due this week" widget. Receivables data, so it needs the same grant as `GET /reports/receivables` (US-OPS-20). */
  @Get("invoices-due-this-week")
  @RequireCapability("reports.view_receivables")
  async invoicesDueThisWeek(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.reportsService.invoicesDueThisWeek(orgId);
  }

  /** US-RPT-12 — the latest daily check that the books balance; Owners only. */
  @Get("ledger-integrity")
  @OrgRoles(["owner"])
  async ledgerIntegrity(@Session() session: UserSession) {
    return this.ledgerIntegrityService.status(requireOrgId(session));
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
  async profitAndLoss(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    const parsed = profitAndLossQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const { from, to, compare } = parsed.data;
    const report = await this.reportsService.profitAndLoss(orgId, from, to);
    if (!compare) return report;
    // US-RPT-27 — the columns to compare, lined up by account.
    try {
      return { ...report, comparison: await this.reportsService.profitAndLossComparison(orgId, from, to, compare) };
    } catch (err) {
      if (err instanceof Error && err.message === TOO_MANY_MONTHS) throw new BadRequestException(TOO_MANY_MONTHS);
      throw err;
    }
  }

  /** S-09.3 — Owner-only, same reasoning as profitAndLoss above. */
  @Get("balance-sheet")
  @OrgRoles(["owner"])
  async balanceSheet(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    const parsed = balanceSheetQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the date and try again.");
    const report = await this.reportsService.balanceSheet(orgId, parsed.data.asOf);
    // US-RPT-27 — "Compare with" → "Previous year end": the same statement on the other date.
    if (!parsed.data.compareAsOf) return report;
    return { ...report, comparison: await this.reportsService.balanceSheet(orgId, parsed.data.compareAsOf) };
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
    @Query("jobId") jobId?: string,
  ) {
    const orgId = requireOrgId(session);
    // US-JOB-26: from a job's cost by category, only that job's lines.
    return this.reportsService.accountDrilldown(orgId, accountId, from, to, jobId || undefined);
  }

  /** S-09.6 — all-jobs profitability summary; its own independent capability, not Owner-only, since Staff who can see jobs already sees per-job costing on the job detail page. */
  @Get("job-profitability")
  @RequireCapability("reports.view_job_profitability")
  async jobProfitability(@Session() session: UserSession, @Query("status") status?: string) {
    const orgId = requireOrgId(session);
    return this.reportsService.jobProfitability(orgId, jobStatusFilter(status));
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

  /** US-RPT-13 — Owner-only, like the other financial statements. */
  @Get("trial-balance")
  @OrgRoles(["owner"])
  async trialBalance(@Session() session: UserSession, @Query("asOf") asOf: string, @Query("includeZero") includeZero?: string) {
    return this.reportsService.trialBalance(requireOrgId(session), asOf, includeZero === "true");
  }

  @Get("trial-balance/export.csv")
  @OrgRoles(["owner"])
  async exportTrialBalance(
    @Session() session: UserSession,
    @Query("asOf") asOf: string,
    @Query("includeZero") includeZero: string | undefined,
    @Res() res: Response,
  ) {
    const report = await this.reportsService.trialBalance(requireOrgId(session), asOf, includeZero === "true");
    const rows = [...report.lines.map((l) => [l.code, l.name, l.debit, l.credit]), ["", "Total", report.totalDebit, report.totalCredit]];
    sendCsv(res, `trial-balance-${asOf}.csv`, toCsv(["Code", "Account", "Debit", "Credit"], rows));
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

  /**
   * US-PAY-10 — one row per open invoice with its bucket. Amounts are
   * plain decimals with the currency in its own column. `search` is the
   * Receivables table's search text, matched the same way (invoice number
   * and contact, ignoring case), so the file is what's on screen.
   */
  @Get("receivables/export.csv")
  @RequireCapability("reports.view_receivables")
  async exportReceivables(@Session() session: UserSession, @Query("search") search: string | undefined, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.receivables(orgId);
    const rows = report.invoices
      .filter((i) => matchesSearch(`${i.number ?? ""} ${i.contactName ?? ""}`, search))
      .map((i) => [i.number, i.contactName, i.currency, i.dueDate, decimal(i.totalAmount, i.currency), decimal(i.balanceDue, i.currency), i.daysOverdue, i.bucket]);
    sendCsv(res, `receivables-${report.asOf}.csv`, toCsv(["Invoice #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  /** US-PUR-14 — one row per open bill with its bucket; same conventions as receivables. */
  @Get("payables/export.csv")
  @RequireCapability("reports.view_payables")
  async exportPayables(@Session() session: UserSession, @Query("search") search: string | undefined, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.payables(orgId);
    const rows = report.bills
      .filter((b) => matchesSearch(`${b.billNumber ?? ""} ${b.contactName ?? ""}`, search))
      .map((b) => [b.billNumber, b.contactName, b.currency, b.dueDate, decimal(b.totalAmount, b.currency), decimal(b.balanceDue, b.currency), b.daysOverdue, b.bucket]);
    sendCsv(res, `payables-${report.asOf}.csv`, toCsv(["Bill #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  @Get("job-profitability/export.csv")
  @RequireCapability("reports.view_job_profitability")
  async exportJobProfitability(@Session() session: UserSession, @Res() res: Response, @Query("status") status?: string) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.jobProfitability(orgId, jobStatusFilter(status));
    // Money as decimals ("1234.50") like every other export; US-RPT-15 adds billed and budget-used columns.
    const rows = report.jobs.map((j) => [
      j.name,
      j.status,
      j.currency,
      decimal(j.contractValueAmount, j.currency),
      decimal(j.billedToDate, j.currency),
      j.billedPct ?? "",
      j.budgetUsedPct ?? "",
      decimal(j.revenue, j.currency),
      decimal(j.cost, j.currency),
      decimal(j.margin, j.currency),
      j.marginPct ?? "",
    ]);
    sendCsv(res, "job-profitability.csv", toCsv(["Job", "Status", "Currency", "Contract value", "Billed to date", "Billed %", "Budget used %", "Revenue", "Cost", "Margin", "Margin %"], rows));
  }
}

/** Minor units → "1234.50", for CSVs a spreadsheet reads as numbers. */
function decimal(minor: string, currency: string): string {
  return toDecimalString({ amount: BigInt(minor), currency });
}

/** The DataTable search rule: case-insensitive substring of the row's search text. */
function matchesSearch(text: string, search: string | undefined): boolean {
  const query = search?.trim().toLowerCase();
  return !query || text.toLowerCase().includes(query);
}

/** US-RPT-15 — `?status=`: active and on hold unless asked for another set. */
function jobStatusFilter(status?: string): JobProfitabilityStatus {
  return status === "active" || status === "on_hold" || status === "completed" || status === "all" ? status : "active_on_hold";
}
