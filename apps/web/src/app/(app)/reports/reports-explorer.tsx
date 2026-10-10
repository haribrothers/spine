"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  DataTable,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  GroupedBarChart,
  ReportFilter,
  ReportFilterCheckbox,
  ReportToolbar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatCard,
  StatementTable,
  ToggleGroup,
  ToggleGroupItem,
  type StatementRow,
  type TableColumn,
} from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import {
  SOURCE_TYPE_ROUTES,
  type AccountDrilldownReport,
  type BalanceSheetReport,
  type JobProfitabilityReport,
  type JobProfitabilityRow,
  type ProfitAndLossReport,
  type ReportAccountLine,
  type TaxSummaryReport,
  type TrialBalanceReport,
} from "./types";
import { formatMoney } from "../../../lib/money";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import {
  budgetUsedLabel,
  FINANCIAL_STATEMENTS_NO_ACCESS,
  MAX_COMPARE_MONTHS,
  PL_COMPARE_LABELS,
  PL_COMPARE_MODES,
  changePercent,
  periodLabel,
  previousYearEnd,
  type PlCompareMode,
  type ProfitAndLossComparison,
} from "@spine/shared";
import { BsCompareTable, PlCompareTable } from "./compare-tables";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { TaxPaymentDialog, TaxPaymentsList } from "./tax-payment-dialog";
import { useEntityToast } from "../payments/entity-toast";
import { ReportTabs, useCurrency } from "./analysis-shared";
import { marginText, RangeFilters, ReportChart, ReportFootnote, ReportKpis, STATEMENT_TABS, useReport } from "./report-kit";
import { useReportDetail } from "./report-shell";
import { JOB_STATUS_LABELS, type Job } from "../jobs/types";
import { STATUS_BADGE_CLASS } from "../jobs/jobs-table";

/** The local calendar date (toISOString would shift it a day in time zones ahead of UTC). */
function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "▲ 11.6% vs previous period" for a card; words and an arrow, not colour alone. */
function cardTrend(current: string, previous: string, against: string): { direction: "up" | "down" | "neutral"; label: string } {
  const pct = changePercent(BigInt(current), BigInt(previous));
  if (pct === null) return { direction: "neutral", label: `— ${against}` };
  if (/^-?0\.0$/.test(pct)) return { direction: "neutral", label: `no change ${against}` };
  return pct.startsWith("-") ? { direction: "down", label: `▼ ${pct.slice(1)}% ${against}` } : { direction: "up", label: `▲ ${pct}% ${against}` };
}

function startOfYear(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** True when this member can open the account drill-down (Owners, or "View ledger / journals"). */
function useCanDrill(): boolean {
  const isOwner = useMyRole() === "owner";
  const canReadLedger = useCapability("ledger.view");
  return isOwner || canReadLedger;
}

const NO_REPORT_ACCESS = "You don't have access to this report. Ask an owner.";
const DRILL_NOTE = "Click an account to see every journal entry behind its figure.";

type Drill = { accountId: string; code: string; name: string };

/** "4100 · Sales — Services", a button that opens the drill-down when the member may. */
function accountCell(line: ReportAccountLine, onDrill?: (d: Drill) => void) {
  const label = line.code ? `${line.code} · ${line.name}` : line.name;
  if (!line.accountId || !onDrill) return label;
  const accountId = line.accountId;
  return (
    <button type="button" onClick={() => onDrill({ accountId, code: line.code, name: line.name })} className="text-left text-primary hover:underline">
      {label}
    </button>
  );
}

/** A statement's sections as rows: heading, a line per account (or a muted note), the section total; then the statement's total. */
function sectionRows(
  sections: { key: string; label: string; lines: ReportAccountLine[]; total: string; totalLabel: string; empty: string }[],
  grand: { label: string; amount: string },
  money: (v: string) => string,
  onDrill?: (d: Drill) => void,
): StatementRow[] {
  return [
    ...sections.flatMap((s): StatementRow[] => [
      { kind: "section", key: `${s.key}-heading`, label: s.label },
      ...(s.lines.length === 0
        ? [{ kind: "empty" as const, key: `${s.key}-empty`, label: s.empty }]
        : s.lines.map((line) => ({ kind: "line" as const, key: `${s.key}-${line.accountId ?? line.code}`, cells: { account: accountCell(line, onDrill), amount: money(line.amount) } }))),
      { kind: "subtotal", key: `${s.key}-total`, cells: { account: s.totalLabel, amount: money(s.total) } },
    ]),
    { kind: "total", key: "grand-total", cells: { account: grand.label, amount: money(grand.amount) } },
  ];
}

const AMOUNT_COLUMNS = [
  { key: "account", header: "Account" },
  { key: "amount", header: "Amount", align: "right" as const },
];

/** How many calendar months a range touches. */
function monthsIn(from: Date, to: Date): number {
  return to.getFullYear() * 12 + to.getMonth() - (from.getFullYear() * 12 + from.getMonth()) + 1;
}

/** US-RPT-40 — income and expenses for each month of the range, from the "Each month" comparison. */
function MonthlyChart({ comparison, currency }: { comparison: ProfitAndLossComparison; currency: string }) {
  const money = (v: string) => formatMoney(v, currency);
  const compact = new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });
  const rows = comparison.columns.map((c, i) => ({ key: c.from, label: c.label, income: Number(comparison.totalIncome[i] ?? 0), expenses: Number(comparison.totalExpenses[i] ?? 0), net: comparison.netProfit[i] ?? "0" }));
  return (
    <ReportChart title="Income and expenses by month" data-testid="pl-chart">
      <GroupedBarChart
        data={rows}
        series={[
          { key: "income", label: "Income", color: "var(--color-primary)" },
          { key: "expenses", label: "Expenses", color: "var(--color-due-soon)" },
        ]}
        formatTick={(v) => compact.format(v / 100)}
        renderTooltip={(row) => (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
            <dt className="col-span-2 mb-1 font-semibold">{row.label}</dt>
            <dt className="text-on-surface-muted">Income</dt>
            <dd className="text-right tabular-nums">{money(String(row.income))}</dd>
            <dt className="text-on-surface-muted">Expenses</dt>
            <dd className="text-right tabular-nums">{money(String(row.expenses))}</dd>
            <dt className="text-on-surface-muted">Net profit</dt>
            <dd className="text-right tabular-nums">{money(String(row.net))}</dd>
          </dl>
        )}
        aria-label="Income and expenses by month"
        description="Choose “Each month” in Compare with to see these figures in the table."
        emptyState="Nothing posted in this range."
      />
    </ReportChart>
  );
}

export function ProfitAndLossTab() {
  const canDrill = useCanDrill();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(startOfYear());
  const [to, setTo] = useState<Date>(endOfToday());
  const [drilldown, setDrilldown] = useState<Drill | null>(null);
  const [compare, setCompare] = useState<"none" | PlCompareMode>("none");
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");

  const range = `from=${toDateParam(from)}&to=${toDateParam(to)}${basis === "cash" ? "&basis=cash" : ""}`;
  const url = `/reports/profit-and-loss?${range}${compare === "none" ? "" : `&compare=${compare}`}`;
  const { data: report, error, loading } = useReport<ProfitAndLossReport>(url, FINANCIAL_STATEMENTS_NO_ACCESS);
  // The chart reads each month's totals; "Each month" already has them.
  const chartable = monthsIn(from, to) <= MAX_COMPARE_MONTHS && from <= to;
  const { data: monthly } = useReport<ProfitAndLossReport>(chartable && compare !== "monthly" ? `/reports/profit-and-loss?${range}&compare=monthly` : null);
  const months = compare === "monthly" ? report?.comparison : monthly?.comparison;

  const comparison = report?.comparison;
  useReportDetail(
    report
      ? [
          comparison ? (comparison.mode === "monthly" ? "by month" : `compared with ${comparison.columns[1]!.label}`) : null,
          report.basis === "cash" ? "Cash basis" : "Accrual basis",
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  );

  const money = (v: string) => formatMoney(BigInt(v), currency);
  const cash = report?.basis === "cash";
  const against = comparison && comparison.mode !== "monthly" ? (comparison.mode === "previous" ? "vs previous period" : "vs last year") : null;
  const trend = (amounts: string[] | undefined) => (against && amounts ? cardTrend(amounts[0]!, amounts[1]!, against) : undefined);
  const onDrill = canDrill && !cash ? setDrilldown : undefined;

  return (
    <>
      <ReportTabs value="profit-and-loss" tabs={STATEMENT_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />
            <ReportFilter label="Compare with">
              {(id) => (
                <Select value={compare} onValueChange={(v) => setCompare(v as typeof compare)}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    {PL_COMPARE_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PL_COMPARE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
            <ReportFilter label="Basis">
              {(id) => (
                <ToggleGroup type="single" value={basis} onValueChange={(v) => v && setBasis(v as typeof basis)} aria-labelledby={id}>
                  <ToggleGroupItem value="accrual" className="px-3">
                    Accrual
                  </ToggleGroupItem>
                  <ToggleGroupItem value="cash" className="px-3">
                    Cash
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </ReportFilter>
          </>
        }
        actions={!error && <ReportExportMenu path={url} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <div className="flex flex-col gap-6" data-testid={cash ? "cash-basis" : comparison ? "pl-comparison" : "pl-statement"}>
          <ReportKpis count={4} data-testid="pl-cards">
            <StatCard label={cash ? "Cash received (income)" : "Total income"} value={money(report.totalIncome)} trend={trend(comparison?.totalIncome) ?? (cash ? { direction: "neutral", label: "paid by customers in the range" } : undefined)} />
            <StatCard label={cash ? "Cash paid (expenses)" : "Total expenses"} value={money(report.totalExpenses)} trend={trend(comparison?.totalExpenses) ?? (cash ? { direction: "neutral", label: "paid to vendors and staff" } : undefined)} />
            <StatCard
              label={cash ? "Net profit (cash basis)" : "Net profit"}
              value={money(report.netProfit)}
              trend={trend(comparison?.netProfit) ?? (cash ? { direction: "neutral", label: `accrual basis: ${money(report.accrualNetProfit ?? "0")}` } : undefined)}
            />
            <StatCard
              label="Net margin"
              value={marginText(report.netProfit, report.totalIncome)}
              trend={against && comparison ? { direction: "neutral", label: `${marginText(comparison.netProfit[1]!, comparison.totalIncome[1]!)} ${against}` } : { direction: "neutral", label: "net profit as a share of income" }}
            />
          </ReportKpis>

          {months && months.columns.length > 1 && <MonthlyChart comparison={months} currency={currency} />}

          {comparison ? (
            <PlCompareTable comparison={comparison} totals={{ income: report.totalIncome, expenses: report.totalExpenses, netProfit: report.netProfit }} currency={currency} />
          ) : (
            <StatementTable
              data-testid={cash ? "cash-basis-table" : "pl-table"}
              columns={AMOUNT_COLUMNS}
              rows={sectionRows(
                [
                  { key: "income", label: "Income", lines: report.income, total: report.totalIncome, totalLabel: cash ? "Cash received" : "Total income", empty: cash ? "Nothing received in this range." : "No income posted in this range." },
                  { key: "expenses", label: "Expenses", lines: report.expenses, total: report.totalExpenses, totalLabel: cash ? "Cash paid" : "Total expenses", empty: cash ? "Nothing paid in this range." : "No expenses posted in this range." },
                ],
                { label: cash ? "Net profit (cash basis)" : "Net profit", amount: report.netProfit },
                money,
                onDrill,
              )}
            />
          )}

          {cash ? (
            <CashBasisNotes report={report} />
          ) : comparison ? (
            <ReportFootnote>Arrows and signs show direction; colour is never the only signal. Choose &quot;Each month&quot; for one column per month plus a total.</ReportFootnote>
          ) : (
            onDrill && <ReportFootnote>{DRILL_NOTE}</ReportFootnote>
          )}
        </div>
      )}

      {drilldown && (
        <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from={toDateParam(from)} to={toDateParam(to)} currency={currency} onClose={() => setDrilldown(null)} />
      )}
    </>
  );
}

/** US-RPT-35 — what the cash basis leaves out, and how it's worked out. */
function CashBasisNotes({ report }: { report: ProfitAndLossReport }) {
  const excluded = report.openingExcluded;
  const cutover = excluded ? new Date(`${excluded.cutoverDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <div className="flex flex-col gap-3" data-testid="cash-basis-notes">
      {excluded && BigInt(excluded.invoices) > 0n && (
        <Alert variant="info">
          <AlertDescription>Payments on invoices from before {cutover} aren&apos;t counted — that income was in your old books.</AlertDescription>
        </Alert>
      )}
      {excluded && BigInt(excluded.bills) > 0n && (
        <Alert variant="info">
          <AlertDescription>Payments on bills from before {cutover} aren&apos;t counted — those costs were in your old books.</AlertDescription>
        </Alert>
      )}
      <ReportFootnote>
        Income counts what customers paid in the range and costs what was paid, split across accounts in proportion to each invoice&apos;s or bill&apos;s lines. The Balance Sheet, Trial Balance and Tax Summary stay on the accrual basis.
      </ReportFootnote>
    </div>
  );
}

export function BalanceSheetTab() {
  const canDrill = useCanDrill();
  const currency = useCurrency();
  const [asOf, setAsOf] = useState<Date>(endOfToday());
  const [drilldown, setDrilldown] = useState<Drill | null>(null);
  const [compare, setCompare] = useState<"none" | "previous_year_end">("none");
  const [yearStart, setYearStart] = useState<{ month: number; day: number } | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { month: number; day: number } | null }>("/org/settings/financial_year_start")
      .then((res) => setYearStart(res.value ?? { month: 1, day: 1 }))
      .catch(() => setYearStart({ month: 1, day: 1 }));
  }, []);

  const date = toDateParam(asOf);
  const url = compare === "none" ? `/reports/balance-sheet?asOf=${date}` : yearStart ? `/reports/balance-sheet?asOf=${date}&compareAsOf=${previousYearEnd(date, yearStart)}` : null;
  const { data: report, error, loading } = useReport<BalanceSheetReport>(url, FINANCIAL_STATEMENTS_NO_ACCESS);
  const comparison = report?.comparison;
  useReportDetail(comparison ? `compared with ${periodLabel(comparison.asOf, comparison.asOf)}` : null);

  const money = (v: string) => formatMoney(BigInt(v), currency);
  const trend = (now: string, then: string | undefined) => (then === undefined ? undefined : cardTrend(now, then, "vs previous year end"));

  return (
    <>
      <ReportTabs value="balance-sheet" tabs={STATEMENT_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <ReportFilter label="As of">
              <DatePicker value={asOf} onChange={(d) => d && setAsOf(d)} />
            </ReportFilter>
            <ReportFilter label="Compare with">
              {(id) => (
                <Select value={compare} onValueChange={(v) => setCompare(v as typeof compare)}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    <SelectItem value="previous_year_end">Previous year end</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
          </>
        }
        actions={!error && url && <ReportExportMenu path={url} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <ReportKpis count={3} data-testid="bs-cards">
            <StatCard label="Total assets" value={money(report.totalAssets)} trend={trend(report.totalAssets, comparison?.totalAssets) ?? { direction: "neutral", label: "what the business owns" }} />
            <StatCard label="Total liabilities" value={money(report.totalLiabilities)} trend={trend(report.totalLiabilities, comparison?.totalLiabilities) ?? { direction: "neutral", label: "what it owes" }} />
            <StatCard label="Total equity" value={money(report.totalEquity)} trend={trend(report.totalEquity, comparison?.totalEquity) ?? { direction: "neutral", label: "assets less liabilities" }} />
          </ReportKpis>

          {comparison ? (
            <BsCompareTable report={report} comparison={comparison} currency={currency} labels={[periodLabel(report.asOf, report.asOf), periodLabel(comparison.asOf, comparison.asOf)]} />
          ) : (
            <StatementTable
              data-testid="bs-table"
              columns={AMOUNT_COLUMNS}
              rows={sectionRows(
                [
                  { key: "assets", label: "Assets", lines: report.assets, total: report.totalAssets, totalLabel: "Total assets", empty: "No assets on this date." },
                  { key: "liabilities", label: "Liabilities", lines: report.liabilities, total: report.totalLiabilities, totalLabel: "Total liabilities", empty: "No liabilities on this date." },
                  { key: "equity", label: "Equity", lines: report.equity, total: report.totalEquity, totalLabel: "Total equity", empty: "No equity on this date." },
                ],
                { label: "Total liabilities + equity", amount: report.totalLiabilitiesAndEquity },
                money,
                canDrill ? setDrilldown : undefined,
              )}
            />
          )}
          {canDrill && !comparison && <ReportFootnote>{DRILL_NOTE}</ReportFootnote>}
        </>
      )}

      {drilldown && <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from="2000-01-01" to={date} currency={currency} onClose={() => setDrilldown(null)} />}
    </>
  );
}

const JOB_STATUS_FILTERS = [
  { value: "active_on_hold", label: "Active and on hold" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
] as const;

const CHART_JOBS = 10;

/**
 * S-09.6 + US-RPT-15 (D-127) — job profitability: a chart of each job's
 * contract value, billed to date and cost (with its budget marked), then
 * the table of every job. The figures are the job Costing tab's own.
 */
export function JobProfitabilityTab() {
  const [status, setStatus] = useState<string>("active_on_hold");
  const url = `/reports/job-profitability?status=${status}`;
  const { data: report, error, loading } = useReport<JobProfitabilityReport>(url, NO_REPORT_ACCESS);

  const currency = report?.jobs[0]?.currency ?? "USD";
  const money = (minor: string | bigint | null) => (minor === null ? "—" : formatMoney(BigInt(minor), currency));
  const sum = (pick: (j: JobProfitabilityRow) => string) => (report?.jobs ?? []).reduce((s, j) => s + BigInt(pick(j)), 0n);
  const totals = { contract: sum((j) => j.contractValueAmount), billed: sum((j) => j.billedToDate), revenue: sum((j) => j.revenue), cost: sum((j) => j.cost), margin: sum((j) => j.margin) };
  const charted = report ? [...report.jobs].sort((a, b) => (BigInt(b.contractValueAmount) > BigInt(a.contractValueAmount) ? 1 : -1)).slice(0, CHART_JOBS) : [];
  const compact = new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });
  const pct = (part: bigint, whole: bigint) => (whole === 0n ? "—" : `${(part * 100n) / whole}%`);

  const columns: TableColumn<JobProfitabilityRow>[] = [
    {
      key: "job",
      header: "Job",
      render: (job) => (
        <Link href={`/jobs/${job.jobId}`} className="font-medium text-primary hover:underline">
          {job.name}
        </Link>
      ),
      sortValue: (job) => job.name,
    },
    {
      key: "status",
      header: "Status",
      render: (job) => {
        const s = job.status as Job["status"];
        return <Badge className={STATUS_BADGE_CLASS[s]}>{JOB_STATUS_LABELS[s] ?? job.status}</Badge>;
      },
    },
    { key: "contract", header: "Contract value", align: "right", render: (job) => <span className="tabular-nums">{money(job.contractValueAmount)}</span>, sortValue: (job) => BigInt(job.contractValueAmount) },
    { key: "billed", header: "Billed to date", align: "right", render: (job) => <span className="tabular-nums">{money(job.billedToDate)}</span>, sortValue: (job) => BigInt(job.billedToDate) },
    { key: "billedPct", header: "Billed %", align: "right", render: (job) => (job.billedPct === null ? "—" : `${job.billedPct}%`), sortValue: (job) => job.billedPct ?? -1 },
    {
      key: "budget",
      header: "Budget used",
      render: (job) => (
        <span className={`inline-flex items-center gap-1 tabular-nums ${job.budgetState === "over" ? "text-overdue" : job.budgetState === "near" ? "text-due-soon" : ""}`}>
          {job.budgetState === "over" && <OctagonAlert size={13} aria-hidden />}
          {job.budgetState === "near" && <AlertTriangle size={13} aria-hidden />}
          {budgetUsedLabel(job.budgetState, job.budgetUsedPct)}
        </span>
      ),
    },
    { key: "revenue", header: "Revenue", align: "right", render: (job) => <span className="tabular-nums">{money(job.revenue)}</span>, sortValue: (job) => BigInt(job.revenue) },
    { key: "cost", header: "Cost", align: "right", render: (job) => <span className="tabular-nums">{money(job.cost)}</span>, sortValue: (job) => BigInt(job.cost) },
    { key: "margin", header: "Margin", align: "right", render: (job) => <span className="tabular-nums">{money(job.margin)}</span>, sortValue: (job) => BigInt(job.margin) },
    { key: "marginPct", header: "Margin %", align: "right", render: (job) => (job.marginPct === null ? "—" : `${job.marginPct}%`), sortValue: (job) => job.marginPct ?? -1 },
  ];

  return (
    <>
      <ReportToolbar
        loading={loading}
        filters={
          <ReportFilter label="Jobs">
            {(id) => (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-56" aria-labelledby={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUS_FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ReportFilter>
        }
        actions={!error && <ReportExportMenu path={url} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!report && !error ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        report &&
        !error && (
          <>
            <ReportKpis count={4} data-testid="job-cards">
              <StatCard label="Jobs" value={String(report.jobs.length)} />
              <StatCard label="Contract value" value={money(totals.contract)} />
              <StatCard label="Billed to date" value={money(totals.billed)} trend={{ direction: "neutral", label: `${pct(totals.billed, totals.contract)} of contract value` }} />
              <StatCard label="Margin" value={money(totals.margin)} trend={{ direction: "neutral", label: `${pct(totals.margin, totals.revenue)} of revenue` }} />
            </ReportKpis>
            {report.jobs.length > 0 && (
              <ReportChart title="Contract, billed and cost by job">
                <GroupedBarChart
                  data={charted.map((job) => ({
                    key: job.jobId,
                    label: job.name,
                    contract: Number(job.contractValueAmount),
                    billed: Number(job.billedToDate),
                    cost: Number(job.cost),
                    budget: job.costBudget === null ? null : Number(job.costBudget),
                  }))}
                  series={[
                    { key: "contract", label: "Contract value", color: "var(--color-on-surface-muted)" },
                    { key: "billed", label: "Billed to date", color: "var(--color-primary)" },
                    { key: "cost", label: "Cost", color: "var(--color-due-soon)" },
                  ]}
                  marker={{ key: "budget", label: "Cost budget", seriesKey: "cost" }}
                  formatTick={(v) => compact.format(v / 100)}
                  renderTooltip={(row) => {
                    const job = charted.find((j) => j.jobId === row.key)!;
                    return (
                      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
                        <dt className="col-span-2 mb-1 font-semibold">{job.name}</dt>
                        <dt className="text-on-surface-muted">Contract value</dt>
                        <dd className="text-right tabular-nums">{money(job.contractValueAmount)}</dd>
                        <dt className="text-on-surface-muted">Billed to date</dt>
                        <dd className="text-right tabular-nums">
                          {money(job.billedToDate)}
                          {job.billedPct !== null && ` · ${job.billedPct}%`}
                        </dd>
                        <dt className="text-on-surface-muted">Cost</dt>
                        <dd className="text-right tabular-nums">{money(job.cost)}</dd>
                        <dt className="text-on-surface-muted">Budget</dt>
                        <dd className="text-right tabular-nums">{job.costBudget === null ? "—" : `${money(job.costBudget)} · ${job.budgetUsedPct ?? 0}% used`}</dd>
                        <dt className="text-on-surface-muted">Margin</dt>
                        <dd className="text-right tabular-nums">{money(job.margin)}</dd>
                      </dl>
                    );
                  }}
                  aria-label="Contract, billed and cost by job"
                  description="The table below lists the same figures for every job."
                />
                {report.jobs.length > CHART_JOBS && (
                  <p className="mt-2 text-[12px] text-on-surface-muted">
                    Showing {CHART_JOBS} of {report.jobs.length} jobs — the table lists them all.
                  </p>
                )}
              </ReportChart>
            )}
            <div data-testid="job-profitability-table">
              <DataTable
                columns={columns}
                data={report.jobs}
                rowKey={(job) => job.jobId}
                searchPlaceholder="Search jobs"
                searchKey={(job) => job.name}
                configurablePageSize
                footer={report.jobs.length ? { job: "Total", contract: money(totals.contract), billed: money(totals.billed), revenue: money(totals.revenue), cost: money(totals.cost), margin: money(totals.margin) } : undefined}
              />
            </div>
            <ReportFootnote>The same figures as each job&apos;s Costing tab: revenue and cost from the ledger, billed to date from issued invoices.</ReportFootnote>
          </>
        )
      )}
    </>
  );
}

/** S-09.4 — the click-through-to-source-documents dialog behind any P&L/Balance Sheet figure. */
/** The account drill-down — also opened from a job's cost by category (US-JOB-26) with `jobId`. */
export function DrilldownDialog({
  accountId,
  accountLabel,
  from,
  to,
  currency,
  onClose,
  jobId,
}: {
  accountId: string;
  accountLabel: string;
  from: string;
  to: string;
  currency: string;
  onClose: () => void;
  /** Only this job's lines. */
  jobId?: string;
}) {
  const { data: report, error } = useReport<AccountDrilldownReport>(`/reports/account-drilldown?accountId=${accountId}&from=${from}&to=${to}${jobId ? `&jobId=${jobId}` : ""}`, NO_REPORT_ACCESS);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{accountLabel}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!report && !error && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}
          {report && !error && (
            <div className="flex flex-col gap-1">
              {report.entries.length === 0 ? (
                <p className="py-4 text-[13px] text-on-surface-muted">No journal entries posted to this account in range.</p>
              ) : (
                report.entries.map((entry) => {
                  const route = SOURCE_TYPE_ROUTES[entry.sourceType]?.(entry.sourceId);
                  const label = entry.narration ?? `${entry.sourceType} ${entry.sourceId}`;
                  const amount = entry.debit !== "0" ? entry.debit : entry.credit;
                  const side = entry.debit !== "0" ? "Dr" : "Cr";
                  return (
                    <div key={entry.journalEntryId} className="flex items-center justify-between border-b border-border py-2 text-[13px] last:border-b-0">
                      <div className="flex flex-col">
                        {route ? (
                          <Link href={route} className="font-medium text-on-surface hover:text-primary hover:underline">
                            {label}
                          </Link>
                        ) : (
                          <span className="text-on-surface">{label}</span>
                        )}
                        <span className="text-[11px] text-on-surface-muted">{new Date(entry.date).toLocaleDateString()}</span>
                      </div>
                      <span className="tabular-nums text-on-surface-muted">
                        {side} {formatMoney(BigInt(amount), currency)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

type TrialBalanceLine = TrialBalanceReport["lines"][number];

/**
 * US-RPT-13 — every account's balance as of a date, on its debit or credit
 * side, with matching totals. Click an account for its journal entries.
 */
export function TrialBalanceTab() {
  const canDrill = useCanDrill();
  const currency = useCurrency();
  const [asOf, setAsOf] = useState<Date>(endOfToday());
  const [hideZero, setHideZero] = useState(true);
  const [drilldown, setDrilldown] = useState<Drill | null>(null);
  const [search, setSearch] = useState("");

  const url = `/reports/trial-balance?asOf=${toDateParam(asOf)}&includeZero=${!hideZero}`;
  const { data: report, error, loading } = useReport<TrialBalanceReport>(url, FINANCIAL_STATEMENTS_NO_ACCESS);

  const money = (value: string | bigint) => (BigInt(value) === 0n ? "—" : formatMoney(value, currency));
  const difference = report ? BigInt(report.totalDebit) - BigInt(report.totalCredit) : 0n;

  const columns: TableColumn<TrialBalanceLine>[] = [
    { key: "code", header: "Code", render: (line) => <span className="tabular-nums text-on-surface-muted">{line.code}</span>, sortValue: (line) => line.code },
    {
      key: "account",
      header: "Account",
      render: (line) =>
        canDrill ? (
          <button type="button" className="text-left text-primary hover:underline" onClick={() => setDrilldown({ accountId: line.accountId, code: line.code, name: line.name })}>
            {line.name}
          </button>
        ) : (
          <span className="text-on-surface">{line.name}</span>
        ),
      sortValue: (line) => line.name,
    },
    { key: "debit", header: "Debit", align: "right", render: (line) => <span className="tabular-nums">{money(line.debit)}</span>, sortValue: (line) => BigInt(line.debit) },
    { key: "credit", header: "Credit", align: "right", render: (line) => <span className="tabular-nums">{money(line.credit)}</span>, sortValue: (line) => BigInt(line.credit) },
  ];

  return (
    <>
      <ReportTabs value="trial-balance" tabs={STATEMENT_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <ReportFilter label="As of">
              <DatePicker value={asOf} onChange={(d) => d && setAsOf(d)} />
            </ReportFilter>
            <ReportFilterCheckbox label="Hide accounts with no balance" checked={hideZero} onCheckedChange={setHideZero} />
          </>
        }
        actions={!error && <ReportExportMenu path={url} search={search} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <ReportKpis count={4} data-testid="tb-cards">
            <StatCard label="Accounts" value={String(report.lines.length)} />
            <StatCard label="Total debits" value={formatMoney(BigInt(report.totalDebit), currency)} />
            <StatCard label="Total credits" value={formatMoney(BigInt(report.totalCredit), currency)} />
            <StatCard
              label="Difference"
              value={formatMoney(difference, currency)}
              trend={report.balanced ? { direction: "neutral", label: "✓ balanced" } : { direction: "down", label: "▼ out of balance" }}
            />
          </ReportKpis>
          {!report.balanced && (
            <Alert variant="critical" data-testid="trial-balance-status">
              <AlertDescription>Out of balance by {formatMoney(difference, currency)}. This has been logged; tell your administrator.</AlertDescription>
            </Alert>
          )}
          <div data-testid="trial-balance-table">
            <DataTable
              columns={columns}
              data={report.lines}
              rowKey={(line) => line.accountId}
              searchPlaceholder="Search accounts"
              searchKey={(line) => `${line.code} ${line.name}`}
              onSearchChange={setSearch}
              configurablePageSize
              pageSizeOptions={[50, 100, 250]}
              footer={{ account: "Total", debit: formatMoney(BigInt(report.totalDebit), currency), credit: formatMoney(BigInt(report.totalCredit), currency) }}
            />
          </div>
          {report.balanced && <ReportFootnote data-testid="trial-balance-status">Balanced — total debits equal total credits.</ReportFootnote>}
          {canDrill && <ReportFootnote>Click an account to see every journal entry behind its balance.</ReportFootnote>}
        </>
      )}

      {drilldown && (
        <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from="2000-01-01" to={toDateParam(asOf)} currency={currency} onClose={() => setDrilldown(null)} />
      )}
    </>
  );
}

/**
 * US-RPT-14 (D-057) — tax collected and paid for a period, with a per-rate
 * breakdown, for filing. Collected is from the ledger (after credit notes
 * and voids); the per-rate rows come from issued invoices' lines (D-031).
 * US-RPT-37 adds the paid side by rate, collected/paid/net by tax type,
 * supply classes and what's been paid to the tax authority.
 */
export function TaxSummaryTab() {
  // Recording tax payments stays Owner-only (US-TAX-08); reading the summary is "View financial statements" (US-RPT-36).
  const isOwner = useMyRole() === "owner";
  const currency = useCurrency();
  // US-DASH-25 — the dashboard's tax card opens this for its period (?from=&to=).
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const [from, setFrom] = useState<Date>(() => (fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState<Date>(() => (toParam ? new Date(`${toParam}T00:00:00`) : endOfToday()));
  // US-TAX-08
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  const { show: showToast, toast } = useEntityToast();

  const url = `/org/tax/summary?from=${toDateParam(from)}&to=${toDateParam(to)}`;
  const { data: report, error, loading } = useReport<TaxSummaryReport>(url, FINANCIAL_STATEMENTS_NO_ACCESS);
  const money = (value: string) => formatMoney(value, currency);

  return (
    <>
      <ReportToolbar
        loading={loading}
        filters={<RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />}
        actions={
          !error && (
            <>
              <ReportExportMenu path={url} />
              {report && isOwner && <Button onClick={() => setPaymentOpen(true)}>Record tax payment</Button>}
            </>
          )
        }
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <ReportKpis count={4} data-testid="tax-summary-cards">
            <StatCard label="Tax collected" value={money(report.taxCollected)} trend={{ direction: "neutral", label: "On issued invoices, after credit notes" }} />
            <StatCard label="Tax paid" value={money(report.taxPaid)} trend={{ direction: "neutral", label: "On bills, expenses and money out, less vendor credits" }} />
            <StatCard label="Net payable" value={money(report.netTaxPayable)} trend={{ direction: "neutral", label: "Collected minus paid" }} />
            {/* US-RPT-37: tax payments recorded for the range (US-TAX-08). */}
            <StatCard label="Paid to the tax authority" value={money(report.payments.paid)} trend={{ direction: "neutral", label: `Still to pay ${money(report.payments.stillToPay)}` }} />
          </ReportKpis>

          {/* US-RPT-37: collected, paid and net by tax type. */}
          <StatementTable
            data-testid="tax-summary-by-type"
            columns={[
              { key: "name", header: "Tax type" },
              { key: "collected", header: "Collected", align: "right" },
              { key: "paid", header: "Paid", align: "right" },
              { key: "net", header: "Net", align: "right" },
            ]}
            rows={[
              ...(report.byTaxType.rows.length === 0 ? [{ kind: "empty" as const, key: "none", label: "No tax collected or paid in this range." }] : []),
              ...report.byTaxType.rows.map((row) => ({ kind: "line" as const, key: row.taxType, cells: { name: row.label, collected: money(row.collected), paid: money(row.paid), net: money(row.net) } })),
              { kind: "total", key: "total", cells: { name: "Total", collected: money(report.byTaxType.total.collected), paid: money(report.byTaxType.total.paid), net: money(report.byTaxType.total.net) } },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatementTable
              data-testid="tax-summary-table"
              columns={[
                { key: "name", header: "Collected by rate" },
                { key: "taxable", header: "Taxable amount", align: "right" },
                { key: "tax", header: "Tax", align: "right" },
              ]}
              rows={[
                ...(report.collectedByRate.length === 0 && !report.adjustments ? [{ kind: "empty" as const, key: "none", label: "No tax collected in this range." }] : []),
                ...report.collectedByRate.map((row) => ({ kind: "line" as const, key: row.name, cells: { name: row.name, taxable: money(row.taxableAmount), tax: money(row.amount) } })),
                ...(report.adjustments
                  ? [{ kind: "line" as const, key: "adjustments", cells: { name: "Adjustments from credit notes and voided invoices", taxable: money(report.adjustments.taxableAmount), tax: money(report.adjustments.amount) } }]
                  : []),
                { kind: "total", key: "total", cells: { name: "Total collected", taxable: money(report.totalTaxable), tax: money(report.taxCollected) } },
              ]}
            />
            <StatementTable
              data-testid="tax-summary-paid"
              columns={[
                { key: "name", header: "Paid by rate" },
                { key: "taxable", header: "Taxable amount", align: "right" },
                { key: "tax", header: "Tax", align: "right" },
              ]}
              rows={[
                ...(report.paidByRate.length === 0 && !report.paidAdjustments ? [{ kind: "empty" as const, key: "none", label: "No tax paid in this range." }] : []),
                ...report.paidByRate.map((row) => ({ kind: "line" as const, key: row.name, cells: { name: row.name, taxable: money(row.taxableAmount), tax: money(row.amount) } })),
                ...(report.paidAdjustments
                  ? [{ kind: "line" as const, key: "adjustments", cells: { name: "Adjustments from voided bills and removed documents", taxable: "—", tax: money(report.paidAdjustments.amount) } }]
                  : []),
                { kind: "total", key: "total", cells: { name: "Total paid", taxable: money(report.totalPaidTaxable), tax: money(report.taxPaid) } },
              ]}
            />
          </div>

          {/* US-RPT-37 (D-147): supplies that carry no tax, by class. */}
          <StatementTable
            data-testid="tax-summary-supply-class"
            columns={[
              { key: "name", header: "Supply class" },
              { key: "sales", header: "Sales", align: "right" },
              { key: "purchases", header: "Purchases", align: "right" },
            ]}
            rows={report.bySupplyClass.map((row) => ({ kind: "line" as const, key: row.supplyClass, cells: { name: row.label, sales: money(row.sales), purchases: money(row.purchases) } }))}
          />
          {isOwner && <TaxPaymentsList from={report.from} to={report.to} currency={currency} version={paymentsVersion} onChanged={() => setPaymentsVersion((v) => v + 1)} />}
          <ReportFootnote>Spine produces the numbers for your return; it doesn&apos;t file it. Owners, and members with &quot;View financial statements&quot;, can see this report.</ReportFootnote>
          <TaxPaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            reportFrom={report.from}
            reportTo={report.to}
            currency={currency}
            onRecorded={(payment) => {
              setPaymentsVersion((v) => v + 1);
              const total = BigInt(payment.amount) + BigInt(payment.inputTaxUsed);
              if (payment.kind === "payment") showToast("Tax payment recorded", `${formatMoney(total, currency)} of output tax is settled for the period.`);
              else showToast("Tax refund recorded", `${formatMoney(payment.amount, currency)} came back from the tax authority.`);
            }}
          />
        </>
      )}
      {toast}
    </>
  );
}
