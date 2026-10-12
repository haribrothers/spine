import { analysisQuerySchema, balanceSheetQuerySchema, creditRegisterQuerySchema, paymentRegisterQuerySchema, cashFlowQuerySchema, profitAndLossQuerySchema, TOO_MANY_MONTHS, dayBookQuerySchema, generalLedgerQuerySchema, toDecimalString, inReceivablesAge, parseReceivablesAge, inPayablesAge, isPayablesAge, type PayablesAge } from "@spine/shared";
import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { toCsv, sendCsv } from "../../common/csv";
import { requireOrgId } from "../org/settings.controller";
import { ReportsService, type JobProfitabilityStatus } from "./reports.service";
import { LedgerIntegrityService } from "./ledger-integrity.service";
import { AnalysisReportsService } from "./analysis-reports.service";
import { CashBasisService } from "./cash-basis.service";
import type { ReportDocument } from "./export/report-document";
import * as docs from "./export/report-documents";
import { ReportExportService } from "./export/report-export.service";
import { CashFlowService } from "./cash-flow.service";
import { RegistersService } from "./registers.service";
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
 * floor (Owner always passes regardless of any grant). US-RPT-36 (D-136):
 * P&L, Balance Sheet, Trial Balance and revenue-trend are no longer
 * Owner-only — `reports.view_financial_statements` opens them to a Team
 * (an outside accountant), read-only; Owners always pass.
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
    private readonly registers: RegistersService,
    private readonly cashBasis: CashBasisService,
    private readonly exporter: ReportExportService,
  ) {}

  /**
   * US-RPT-32 (D-144) — `?format=csv|xlsx` turns any report into a download
   * of exactly what the page shows (`search` included); without it the
   * route answers JSON as before.
   */
  private async out<T>(orgId: string, query: unknown, report: Promise<T> | T, build: (report: T, search: string | undefined) => Omit<ReportDocument, "currency">) {
    const q = (query ?? {}) as Record<string, unknown>;
    const format = ReportExportService.parseFormat(q.format);
    const resolved = await report;
    if (!format) return resolved;
    return this.exporter.file(orgId, format, build(resolved, typeof q.search === "string" ? q.search : undefined));
  }

  /** US-RPT-35 (D-138) — the accrual P&L from the ledger, or the cash-basis view derived at report time. */
  private profitAndLossLoader(orgId: string, basis: "accrual" | "cash") {
    return (from: string, to: string) => (basis === "cash" ? this.cashBasis.profitAndLoss(orgId, from, to) : this.reportsService.profitAndLoss(orgId, from, to));
  }

  private registerQuery(query: unknown) {
    const parsed = paymentRegisterQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return parsed.data;
  }

  /** US-RPT-30 — customer payments in a range, optionally one money account. Owner, or `reports.view_receivables`. */
  @Get("payments-received")
  @RequireCapability("reports.view_receivables")
  async paymentsReceived(@Session() session: UserSession, @Query() query: unknown) {
    const q = this.registerQuery(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.registers.paymentsReceived(orgId, q.from, q.to, q.moneyAccountId), (r, search) => docs.paymentRegisterDocument(r, "received", search, r.rows.find((x) => x.moneyAccount?.id === q.moneyAccountId)?.moneyAccount?.name));
  }

  /** US-RPT-30 — vendor payments in a range, optionally one money account. Owner, or `reports.view_payables`. */
  @Get("payments-made")
  @RequireCapability("reports.view_payables")
  async paymentsMade(@Session() session: UserSession, @Query() query: unknown) {
    const q = this.registerQuery(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.registers.paymentsMade(orgId, q.from, q.to, q.moneyAccountId), (r, search) => docs.paymentRegisterDocument(r, "made", search, r.rows.find((x) => x.moneyAccount?.id === q.moneyAccountId)?.moneyAccount?.name));
  }

  private creditQuery(query: unknown) {
    const parsed = creditRegisterQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return parsed.data;
  }

  /** US-RPT-31 — credit notes in a range: applied, refunded, still held. Owner, or `reports.view_receivables`. */
  @Get("customer-credits")
  @RequireCapability("reports.view_receivables")
  async customerCredits(@Session() session: UserSession, @Query() query: unknown) {
    const q = this.creditQuery(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.registers.customerCredits(orgId, q.from, q.to), (r, search) => docs.creditRegisterDocument(r, "customer", search));
  }

  /** US-RPT-31 — vendor credits in a range: applied, refunded, still held. Owner, or `reports.view_payables`. */
  @Get("vendor-credits")
  @RequireCapability("reports.view_payables")
  async vendorCreditsRegister(@Session() session: UserSession, @Query() query: unknown) {
    const q = this.creditQuery(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.registers.vendorCredits(orgId, q.from, q.to), (r, search) => docs.creditRegisterDocument(r, "vendor", search));
  }

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
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.analysis.salesByCustomer(orgId, from, to), docs.salesByCustomerDocument);
  }

  /** US-RPT-28 — quantity, sales and average price per catalogue item. Owner, or `reports.view_financial_statements`. */
  @Get("sales-by-item")
  @RequireCapability("reports.view_financial_statements")
  async salesByItem(@Session() session: UserSession, @Query() query: unknown) {
    const { from, to } = this.analysisRange(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.analysis.salesByItem(orgId, from, to), docs.salesByItemDocument);
  }

  /** US-RPT-29 — each expense account's amount and share, largest first. Owner, or `reports.view_financial_statements`. */
  @Get("expenses-by-category")
  @RequireCapability("reports.view_financial_statements")
  async expensesByCategory(@Session() session: UserSession, @Query() query: unknown) {
    const { from, to } = this.analysisRange(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.analysis.expensesByCategory(orgId, from, to), docs.expensesByCategoryDocument);
  }

  /** US-RPT-29 — each vendor's bills, net of vendor credits. Owner, or `reports.view_financial_statements`. */
  @Get("purchases-by-vendor")
  @RequireCapability("reports.view_financial_statements")
  async purchasesByVendor(@Session() session: UserSession, @Query() query: unknown) {
    const { from, to } = this.analysisRange(query);
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.analysis.purchasesByVendor(orgId, from, to), docs.purchasesByVendorDocument);
  }

  /** US-RPT-26 — where cash came from and where it went, indirect method. Owner, or `reports.view_financial_statements`. */
  @Get("cash-flow")
  @RequireCapability("reports.view_financial_statements")
  async cashFlowStatement(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = cashFlowQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    if (parsed.data.from > parsed.data.to) throw new BadRequestException("Choose a From date on or before the To date.");
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.cashFlow.report(orgId, parsed.data.from, parsed.data.to), docs.cashFlowDocument);
  }

  /** US-RPT-24 — every account's opening balance, entries and closing balance; paged by account. Owner, or `ledger.view`. */
  @Get("general-ledger")
  @RequireCapability("ledger.view")
  async generalLedger(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = generalLedgerQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const orgId = requireOrgId(session);
    // An export holds every account the filters pick, not just the page on screen.
    const format = ReportExportService.parseFormat((query as Record<string, unknown> | undefined)?.format);
    const options = format ? { ...parsed.data, page: 1, pageSize: 100_000 } : parsed.data;
    return this.out(orgId, query, this.ledgerReports.generalLedger(orgId, options), docs.generalLedgerDocument);
  }

  /** US-RPT-25 — every journal entry in date order, optionally one kind of source. Owner, or `ledger.view`. */
  @Get("day-book")
  @RequireCapability("ledger.view")
  async dayBook(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = dayBookQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.ledgerReports.dayBook(orgId, parsed.data), (r, search) => docs.dayBookDocument(r, parsed.data.sourceType, search));
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
  async moneyInOut(@Session() session: UserSession, @Query("months") months?: string, @Query("basis") basis?: string) {
    const n = months === "3" ? 3 : months === "6" ? 6 : 12;
    // US-DASH-26 (D-179) — Accrual shows income and expenses; Cash (the default) money in and out.
    if (basis === "accrual") return this.reportsService.incomeExpensesByMonth(requireOrgId(session), n);
    return { ...(await this.reportsService.moneyInOut(requireOrgId(session), n)), basis: "cash" as const };
  }

  /** S-09.11 (dashboard v2) — revenue trend chart; same gate as P&L/Balance Sheet (US-RPT-36), since it's derived from the same income-account history. */
  @Get("revenue-trend")
  @RequireCapability("reports.view_financial_statements")
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
  async receivables(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    // US-PAY-29: an age (the list's) narrows the invoices — the Excel and PDF exports follow it; the totals keep every age.
    const age = parseReceivablesAge(typeof (query as { age?: unknown })?.age === "string" ? (query as { age: string }).age : undefined);
    const report = this.reportsService.receivables(orgId).then((r) => (age ? { ...r, invoices: r.invoices.filter((i) => inReceivablesAge(i.bucket, age)) } : r));
    return this.out(orgId, query, report, docs.receivablesDocument);
  }

  /** S-07.7 — the AP-side mirror of receivables above; its own independent capability, since Staff already manages vendor bills/payments end-to-end via the `vendor_bills.*`/`vendor_payments.*` capabilities and reasonably needs to see what's due, but that doesn't imply visibility into who owes THE ORG money. */
  @Get("payables")
  @RequireCapability("reports.view_payables")
  async payables(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    // US-PUR-59: an age narrows the bills — the Excel and PDF exports follow it; the totals keep every age.
    const age = payablesAgeParam((query as { age?: unknown })?.age);
    const report = this.reportsService.payables(orgId).then((r) => (age ? { ...r, bills: r.bills.filter((b) => inPayablesAge(b, age)) } : r));
    return this.out(orgId, query, report, docs.payablesDocument);
  }

  /** S-09.2 — Owner, or `reports.view_financial_statements` (US-RPT-36). */
  @Get("profit-and-loss")
  @RequireCapability("reports.view_financial_statements")
  async profitAndLoss(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    const parsed = profitAndLossQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const { from, to, compare, basis } = parsed.data;
    const load = this.profitAndLossLoader(orgId, basis);
    const report =
      basis === "cash"
        ? // The cards show the accrual figure beside the cash one.
          { ...(await load(from, to)), accrualNetProfit: (await this.reportsService.profitAndLoss(orgId, from, to)).netProfit }
        : { ...(await load(from, to)), basis: "accrual" as const };
    if (!compare) return this.out(orgId, query, report, docs.profitAndLossDocument);
    // US-RPT-27 — the columns to compare, lined up by account.
    let comparison;
    try {
      comparison = await this.reportsService.profitAndLossComparison(orgId, from, to, compare, load);
    } catch (err) {
      if (err instanceof Error && err.message === TOO_MANY_MONTHS) throw new BadRequestException(TOO_MANY_MONTHS);
      throw err;
    }
    return this.out(orgId, query, { ...report, comparison }, docs.profitAndLossDocument);
  }

  /** S-09.3 — same gate as profitAndLoss above. */
  @Get("balance-sheet")
  @RequireCapability("reports.view_financial_statements")
  async balanceSheet(@Session() session: UserSession, @Query() query: unknown) {
    const orgId = requireOrgId(session);
    const parsed = balanceSheetQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the date and try again.");
    const report = await this.reportsService.balanceSheet(orgId, parsed.data.asOf);
    // US-RPT-27 — "Compare with" → "Previous year end": the same statement on the other date.
    const full = parsed.data.compareAsOf ? { ...report, comparison: await this.reportsService.balanceSheet(orgId, parsed.data.compareAsOf) } : report;
    return this.out(orgId, query, full, docs.balanceSheetDocument);
  }

  /** S-09.4 — drill-down behind a P&L/Balance Sheet figure. `@OrgRoles(["owner"])` is a floor (Owner always passes); `ledger.view` additionally lets a Staff user in a granted Team reach this too, separately from `reports.view_financial_statements` (US-RPT-36), which opens the statements themselves — drilling into raw journal entries is the narrower, more literal "view the ledger" grant. */
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
  async jobProfitability(@Session() session: UserSession, @Query() query: unknown, @Query("status") status?: string) {
    const orgId = requireOrgId(session);
    const filter = jobStatusFilter(status);
    return this.out(orgId, query, this.reportsService.jobProfitability(orgId, filter), (r) => docs.jobProfitabilityDocument(r, filter));
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
  @RequireCapability("reports.view_financial_statements")
  async exportProfitAndLoss(@Session() session: UserSession, @Query() query: unknown, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const parsed = profitAndLossQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const { from, to, basis } = parsed.data;
    const report = await this.profitAndLossLoader(orgId, basis)(from, to);
    const rows = [
      // US-RPT-35 — exports say which basis they're on.
      ["Basis", "", basis === "cash" ? "Cash basis" : "Accrual basis", ""],
      ...report.income.map((l) => ["Income", l.code, l.name, l.amount]),
      ["Income", "", "Total income", report.totalIncome],
      ...report.expenses.map((l) => ["Expense", l.code, l.name, l.amount]),
      ["Expense", "", "Total expenses", report.totalExpenses],
      ["", "", "Net profit", report.netProfit],
    ];
    sendCsv(res, `profit-and-loss-${basis === "cash" ? "cash-basis-" : ""}${from}-to-${to}.csv`, toCsv(["Section", "Code", "Account", "Amount"], rows));
  }

  /** US-RPT-13 — same gate as the other financial statements. */
  @Get("trial-balance")
  @RequireCapability("reports.view_financial_statements")
  async trialBalance(@Session() session: UserSession, @Query() query: unknown, @Query("asOf") asOf: string, @Query("includeZero") includeZero?: string) {
    const orgId = requireOrgId(session);
    return this.out(orgId, query, this.reportsService.trialBalance(orgId, asOf, includeZero === "true"), docs.trialBalanceDocument);
  }

  @Get("trial-balance/export.csv")
  @RequireCapability("reports.view_financial_statements")
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
  @RequireCapability("reports.view_financial_statements")
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
   * and contact, ignoring case), and `age` the list's age (US-PAY-29), so
   * the file is what's on screen.
   */
  @Get("receivables/export.csv")
  @RequireCapability("reports.view_receivables")
  async exportReceivables(@Session() session: UserSession, @Query("search") search: string | undefined, @Query("age") age: string | undefined, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const report = await this.reportsService.receivables(orgId);
    // US-PAY-29: the list's age too (an unknown age keeps every row).
    const chosen = parseReceivablesAge(age);
    const rows = report.invoices
      .filter((i) => inReceivablesAge(i.bucket, chosen) && matchesSearch(`${i.number ?? ""} ${i.contactName ?? ""}`, search))
      .map((i) => [i.number, i.contactName, i.currency, i.dueDate, decimal(i.totalAmount, i.currency), decimal(i.balanceDue, i.currency), i.daysOverdue, i.bucket]);
    sendCsv(res, `receivables-${report.asOf}.csv`, toCsv(["Invoice #", "Contact", "Currency", "Due date", "Total", "Balance due", "Days overdue", "Bucket"], rows));
  }

  /** US-PUR-14 — one row per open bill with its bucket; same conventions as receivables. `age` is the list's age (US-PUR-59). */
  @Get("payables/export.csv")
  @RequireCapability("reports.view_payables")
  async exportPayables(@Session() session: UserSession, @Query("search") search: string | undefined, @Query("age") age: string | undefined, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const chosen = payablesAgeParam(age);
    const report = await this.reportsService.payables(orgId);
    const rows = report.bills
      .filter((b) => inPayablesAge(b, chosen) && matchesSearch(`${b.billNumber ?? ""} ${b.contactName ?? ""} ${b.jobName ?? ""}`, search))
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

/** US-PUR-59 — the list's age, or every age when there's none; an unknown age is refused. */
function payablesAgeParam(age: unknown): PayablesAge | null {
  if (age === undefined || age === "") return null;
  if (typeof age === "string" && isPayablesAge(age)) return age;
  throw new BadRequestException("Choose an age to show.");
}
