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
import { formatMoney, orgLocaleTag } from "../../../lib/money";
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
import { useToast } from "../../../components/toast-host";
import { ReportTabs, useCurrency } from "./analysis-shared";
import { marginText, RangeFilters, ReportChart, ReportFootnote, ReportKpis, STATEMENT_TABS, useReport } from "./report-kit";
import { useReportDetail } from "./report-shell";
import { JOB_STATUS_LABELS, type Job } from "../jobs/types";
import { STATUS_BADGE_CLASS } from "../jobs/jobs-table";

import { SectionLink } from "../../../components/section-link";
import { t, useT } from "../../../lib/i18n";
/** The local calendar date (toISOString would shift it a day in time zones ahead of UTC). */
function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "▲ 11.6% vs previous period" for a card; words and an arrow, not colour alone. */
function cardTrend(current: string, previous: string, against: string): { direction: "up" | "down" | "neutral"; label: string } {
  const pct = changePercent(BigInt(current), BigInt(previous));
  if (pct === null) return { direction: "neutral", label: t("reports.explorer.trend.none", { against }) };
  if (/^-?0\.0$/.test(pct)) return { direction: "neutral", label: t("reports.explorer.trend.noChange", { against }) };
  return pct.startsWith("-") ? { direction: "down", label: t("reports.explorer.trend.down", { pct: pct.slice(1), against }) } : { direction: "up", label: t("reports.explorer.trend.up", { pct, against }) };
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

const NO_REPORT_ACCESS = t("reports.common.noAccess");
const DRILL_NOTE = t("reports.explorer.drillNote");

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
  { key: "account", header: t("reports.common.account") },
  { key: "amount", header: t("reports.common.amount"), align: "right" as const },
];

/** How many calendar months a range touches. */
function monthsIn(from: Date, to: Date): number {
  return to.getFullYear() * 12 + to.getMonth() - (from.getFullYear() * 12 + from.getMonth()) + 1;
}

/** US-RPT-40 — income and expenses for each month of the range, from the "Each month" comparison. */
function MonthlyChart({ comparison, currency }: { comparison: ProfitAndLossComparison; currency: string }) {
  const t = useT();
  const money = (v: string) => formatMoney(v, currency);
  const compact = new Intl.NumberFormat(orgLocaleTag(), { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });
  const rows = comparison.columns.map((c, i) => ({ key: c.from, label: c.label, income: Number(comparison.totalIncome[i] ?? 0), expenses: Number(comparison.totalExpenses[i] ?? 0), net: comparison.netProfit[i] ?? "0" }));
  return (
    <ReportChart title={t("reports.explorer.monthlyChart.title")} data-testid="pl-chart">
      <GroupedBarChart
        data={rows}
        series={[
          { key: "income", label: t("reports.common.income"), color: "var(--color-primary)" },
          { key: "expenses", label: t("reports.common.expenses"), color: "var(--color-due-soon)" },
        ]}
        formatTick={(v) => compact.format(v / 100)}
        renderTooltip={(row) => (
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
            <dt className="col-span-2 mb-1 font-semibold">{row.label}</dt>
            <dt className="text-on-surface-muted">{t("reports.common.income")}</dt>
            <dd className="text-right tabular-nums">{money(String(row.income))}</dd>
            <dt className="text-on-surface-muted">{t("reports.common.expenses")}</dt>
            <dd className="text-right tabular-nums">{money(String(row.expenses))}</dd>
            <dt className="text-on-surface-muted">{t("reports.common.netProfit")}</dt>
            <dd className="text-right tabular-nums">{money(String(row.net))}</dd>
          </dl>
        )}
        aria-label={t("reports.explorer.monthlyChart.title")}
        description={t("reports.explorer.monthlyChart.description")}
        emptyState={t("reports.explorer.monthlyChart.empty")}
      />
    </ReportChart>
  );
}

export function ProfitAndLossTab() {
  const t = useT();
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
          comparison ? (comparison.mode === "monthly" ? t("reports.explorer.pl.byMonth") : t("reports.explorer.pl.comparedWith", { label: comparison.columns[1]!.label })) : null,
          report.basis === "cash" ? t("reports.explorer.pl.cashBasis") : t("reports.explorer.pl.accrualBasis"),
        ]
          .filter(Boolean)
          .join(" · ")
      : null,
  );

  const money = (v: string) => formatMoney(BigInt(v), currency);
  const cash = report?.basis === "cash";
  const against = comparison && comparison.mode !== "monthly" ? (comparison.mode === "previous" ? t("reports.explorer.pl.vsPreviousPeriod") : t("reports.explorer.pl.vsLastYear")) : null;
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
            <ReportFilter label={t("reports.common.compareWith")}>
              {(id) => (
                <Select value={compare} onValueChange={(v) => setCompare(v as typeof compare)}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("reports.common.noComparison")}</SelectItem>
                    {PL_COMPARE_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PL_COMPARE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
            <ReportFilter label={t("reports.explorer.pl.basis")}>
              {(id) => (
                <ToggleGroup type="single" value={basis} onValueChange={(v) => v && setBasis(v as typeof basis)} aria-labelledby={id}>
                  <ToggleGroupItem value="accrual" className="px-3">
                    {t("reports.explorer.pl.accrual")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="cash" className="px-3">
                    {t("reports.explorer.pl.cash")}
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
            <StatCard label={cash ? t("reports.explorer.pl.cashReceivedIncome") : t("reports.common.totalIncome")} value={money(report.totalIncome)} trend={trend(comparison?.totalIncome) ?? (cash ? { direction: "neutral", label: t("reports.explorer.pl.paidByCustomers") } : undefined)} />
            <StatCard label={cash ? t("reports.explorer.pl.cashPaidExpenses") : t("reports.common.totalExpenses")} value={money(report.totalExpenses)} trend={trend(comparison?.totalExpenses) ?? (cash ? { direction: "neutral", label: t("reports.explorer.pl.paidToVendors") } : undefined)} />
            <StatCard
              label={cash ? t("reports.explorer.pl.netProfitCash") : t("reports.common.netProfit")}
              value={money(report.netProfit)}
              trend={trend(comparison?.netProfit) ?? (cash ? { direction: "neutral", label: t("reports.explorer.pl.accrualBasisAmount", { amount: money(report.accrualNetProfit ?? "0") }) } : undefined)}
            />
            <StatCard
              label={t("reports.explorer.pl.netMargin")}
              value={marginText(report.netProfit, report.totalIncome)}
              trend={against && comparison ? { direction: "neutral", label: `${marginText(comparison.netProfit[1]!, comparison.totalIncome[1]!)} ${against}` } : { direction: "neutral", label: t("reports.explorer.pl.netMarginHint") }}
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
                  { key: "income", label: t("reports.common.income"), lines: report.income, total: report.totalIncome, totalLabel: cash ? t("reports.explorer.pl.cashReceived") : t("reports.common.totalIncome"), empty: cash ? t("reports.explorer.pl.nothingReceived") : t("reports.explorer.pl.noIncome") },
                  { key: "expenses", label: t("reports.common.expenses"), lines: report.expenses, total: report.totalExpenses, totalLabel: cash ? t("reports.explorer.pl.cashPaid") : t("reports.common.totalExpenses"), empty: cash ? t("reports.explorer.pl.nothingPaid") : t("reports.explorer.pl.noExpenses") },
                ],
                { label: cash ? t("reports.explorer.pl.netProfitCash") : t("reports.common.netProfit"), amount: report.netProfit },
                money,
                onDrill,
              )}
            />
          )}

          {cash ? (
            <CashBasisNotes report={report} />
          ) : comparison ? (
            <ReportFootnote>{t("reports.explorer.pl.compareFootnote")}</ReportFootnote>
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
  const t = useT();
  const excluded = report.openingExcluded;
  const cutover = excluded ? new Date(`${excluded.cutoverDate}T00:00:00`).toLocaleDateString(orgLocaleTag(), { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <div className="flex flex-col gap-3" data-testid="cash-basis-notes">
      {excluded && BigInt(excluded.invoices) > 0n && (
        <Alert variant="info">
          <AlertDescription>{t("reports.explorer.cashNotes.invoicesExcluded", { cutover })}</AlertDescription>
        </Alert>
      )}
      {excluded && BigInt(excluded.bills) > 0n && (
        <Alert variant="info">
          <AlertDescription>{t("reports.explorer.cashNotes.billsExcluded", { cutover })}</AlertDescription>
        </Alert>
      )}
      <ReportFootnote>{t("reports.explorer.cashNotes.footnote")}</ReportFootnote>
    </div>
  );
}

export function BalanceSheetTab() {
  const t = useT();
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
  useReportDetail(comparison ? t("reports.explorer.bs.comparedWith", { label: periodLabel(comparison.asOf, comparison.asOf) }) : null);

  const money = (v: string) => formatMoney(BigInt(v), currency);
  const trend = (now: string, then: string | undefined) => (then === undefined ? undefined : cardTrend(now, then, t("reports.explorer.bs.vsPreviousYearEnd")));

  return (
    <>
      <ReportTabs value="balance-sheet" tabs={STATEMENT_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <ReportFilter label={t("reports.common.asOf")}>
              <DatePicker value={asOf} onChange={(d) => d && setAsOf(d)} />
            </ReportFilter>
            <ReportFilter label={t("reports.common.compareWith")}>
              {(id) => (
                <Select value={compare} onValueChange={(v) => setCompare(v as typeof compare)}>
                  <SelectTrigger className="w-56" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("reports.common.noComparison")}</SelectItem>
                    <SelectItem value="previous_year_end">{t("reports.explorer.bs.previousYearEnd")}</SelectItem>
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
            <StatCard label={t("reports.common.totalAssets")} value={money(report.totalAssets)} trend={trend(report.totalAssets, comparison?.totalAssets) ?? { direction: "neutral", label: t("reports.explorer.bs.assetsHint") }} />
            <StatCard label={t("reports.common.totalLiabilities")} value={money(report.totalLiabilities)} trend={trend(report.totalLiabilities, comparison?.totalLiabilities) ?? { direction: "neutral", label: t("reports.explorer.bs.liabilitiesHint") }} />
            <StatCard label={t("reports.common.totalEquity")} value={money(report.totalEquity)} trend={trend(report.totalEquity, comparison?.totalEquity) ?? { direction: "neutral", label: t("reports.explorer.bs.equityHint") }} />
          </ReportKpis>

          {comparison ? (
            <BsCompareTable report={report} comparison={comparison} currency={currency} labels={[periodLabel(report.asOf, report.asOf), periodLabel(comparison.asOf, comparison.asOf)]} />
          ) : (
            <StatementTable
              data-testid="bs-table"
              columns={AMOUNT_COLUMNS}
              rows={sectionRows(
                [
                  { key: "assets", label: t("reports.common.assets"), lines: report.assets, total: report.totalAssets, totalLabel: t("reports.common.totalAssets"), empty: t("reports.explorer.bs.noAssets") },
                  { key: "liabilities", label: t("reports.common.liabilities"), lines: report.liabilities, total: report.totalLiabilities, totalLabel: t("reports.common.totalLiabilities"), empty: t("reports.explorer.bs.noLiabilities") },
                  { key: "equity", label: t("reports.common.equity"), lines: report.equity, total: report.totalEquity, totalLabel: t("reports.common.totalEquity"), empty: t("reports.explorer.bs.noEquity") },
                ],
                { label: t("reports.common.totalLiabilitiesAndEquity"), amount: report.totalLiabilitiesAndEquity },
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
  { value: "active_on_hold", label: t("reports.explorer.jobs.filterActiveOnHold") },
  { value: "active", label: t("reports.explorer.jobs.filterActive") },
  { value: "on_hold", label: t("reports.explorer.jobs.filterOnHold") },
  { value: "completed", label: t("reports.explorer.jobs.filterCompleted") },
  { value: "all", label: t("reports.explorer.jobs.filterAll") },
] as const;

const CHART_JOBS = 10;

/**
 * S-09.6 + US-RPT-15 (D-127) — job profitability: a chart of each job's
 * contract value, billed to date and cost (with its budget marked), then
 * the table of every job. The figures are the job Costing tab's own.
 */
export function JobProfitabilityTab() {
  const t = useT();
  const [status, setStatus] = useState<string>("active_on_hold");
  const url = `/reports/job-profitability?status=${status}`;
  const { data: report, error, loading } = useReport<JobProfitabilityReport>(url, NO_REPORT_ACCESS);

  const currency = report?.jobs[0]?.currency ?? "USD";
  const money = (minor: string | bigint | null) => (minor === null ? "—" : formatMoney(BigInt(minor), currency));
  const sum = (pick: (j: JobProfitabilityRow) => string) => (report?.jobs ?? []).reduce((s, j) => s + BigInt(pick(j)), 0n);
  const totals = { contract: sum((j) => j.contractValueAmount), billed: sum((j) => j.billedToDate), revenue: sum((j) => j.revenue), cost: sum((j) => j.cost), margin: sum((j) => j.margin) };
  const charted = report ? [...report.jobs].sort((a, b) => (BigInt(b.contractValueAmount) > BigInt(a.contractValueAmount) ? 1 : -1)).slice(0, CHART_JOBS) : [];
  const compact = new Intl.NumberFormat(orgLocaleTag(), { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });
  const pct = (part: bigint, whole: bigint) => (whole === 0n ? "—" : `${(part * 100n) / whole}%`);

  const columns: TableColumn<JobProfitabilityRow>[] = [
    {
      key: "job",
      header: t("reports.common.job"),
      render: (job) => (
        <SectionLink href={`/jobs/${job.jobId}`} className="font-medium text-primary hover:underline">
          {job.name}
        </SectionLink>
      ),
      sortValue: (job) => job.name,
    },
    {
      key: "status",
      header: t("reports.common.status"),
      render: (job) => {
        const s = job.status as Job["status"];
        return <Badge className={STATUS_BADGE_CLASS[s]}>{JOB_STATUS_LABELS[s] ?? job.status}</Badge>;
      },
    },
    { key: "contract", header: t("reports.common.contractValue"), align: "right", render: (job) => <span className="tabular-nums">{money(job.contractValueAmount)}</span>, sortValue: (job) => BigInt(job.contractValueAmount) },
    { key: "billed", header: t("reports.common.billedToDate"), align: "right", render: (job) => <span className="tabular-nums">{money(job.billedToDate)}</span>, sortValue: (job) => BigInt(job.billedToDate) },
    { key: "billedPct", header: t("reports.explorer.jobs.billedPct"), align: "right", render: (job) => (job.billedPct === null ? "—" : `${job.billedPct}%`), sortValue: (job) => job.billedPct ?? -1 },
    {
      key: "budget",
      header: t("reports.explorer.jobs.budgetUsed"),
      render: (job) => (
        <span className={`inline-flex items-center gap-1 tabular-nums ${job.budgetState === "over" ? "text-overdue" : job.budgetState === "near" ? "text-due-soon" : ""}`}>
          {job.budgetState === "over" && <OctagonAlert size={13} aria-hidden />}
          {job.budgetState === "near" && <AlertTriangle size={13} aria-hidden />}
          {budgetUsedLabel(job.budgetState, job.budgetUsedPct)}
        </span>
      ),
    },
    { key: "revenue", header: t("reports.common.revenue"), align: "right", render: (job) => <span className="tabular-nums">{money(job.revenue)}</span>, sortValue: (job) => BigInt(job.revenue) },
    { key: "cost", header: t("reports.common.cost"), align: "right", render: (job) => <span className="tabular-nums">{money(job.cost)}</span>, sortValue: (job) => BigInt(job.cost) },
    { key: "margin", header: t("reports.common.margin"), align: "right", render: (job) => <span className="tabular-nums">{money(job.margin)}</span>, sortValue: (job) => BigInt(job.margin) },
    { key: "marginPct", header: t("reports.explorer.jobs.marginPct"), align: "right", render: (job) => (job.marginPct === null ? "—" : `${job.marginPct}%`), sortValue: (job) => job.marginPct ?? -1 },
  ];

  return (
    <>
      <ReportToolbar
        loading={loading}
        filters={
          <ReportFilter label={t("reports.common.jobs")}>
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
              <StatCard label={t("reports.common.jobs")} value={String(report.jobs.length)} />
              <StatCard label={t("reports.common.contractValue")} value={money(totals.contract)} />
              <StatCard label={t("reports.common.billedToDate")} value={money(totals.billed)} trend={{ direction: "neutral", label: t("reports.explorer.jobs.ofContractValue", { pct: pct(totals.billed, totals.contract) }) }} />
              <StatCard label={t("reports.common.margin")} value={money(totals.margin)} trend={{ direction: "neutral", label: t("reports.explorer.jobs.ofRevenue", { pct: pct(totals.margin, totals.revenue) }) }} />
            </ReportKpis>
            {report.jobs.length > 0 && (
              <ReportChart title={t("reports.explorer.jobs.chartTitle")}>
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
                    { key: "contract", label: t("reports.common.contractValue"), color: "var(--color-on-surface-muted)" },
                    { key: "billed", label: t("reports.common.billedToDate"), color: "var(--color-primary)" },
                    { key: "cost", label: t("reports.common.cost"), color: "var(--color-due-soon)" },
                  ]}
                  marker={{ key: "budget", label: t("reports.explorer.jobs.costBudget"), seriesKey: "cost" }}
                  formatTick={(v) => compact.format(v / 100)}
                  renderTooltip={(row) => {
                    const job = charted.find((j) => j.jobId === row.key)!;
                    return (
                      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
                        <dt className="col-span-2 mb-1 font-semibold">{job.name}</dt>
                        <dt className="text-on-surface-muted">{t("reports.common.contractValue")}</dt>
                        <dd className="text-right tabular-nums">{money(job.contractValueAmount)}</dd>
                        <dt className="text-on-surface-muted">{t("reports.common.billedToDate")}</dt>
                        <dd className="text-right tabular-nums">
                          {money(job.billedToDate)}
                          {job.billedPct !== null && ` · ${job.billedPct}%`}
                        </dd>
                        <dt className="text-on-surface-muted">{t("reports.common.cost")}</dt>
                        <dd className="text-right tabular-nums">{money(job.cost)}</dd>
                        <dt className="text-on-surface-muted">{t("reports.explorer.jobs.budget")}</dt>
                        <dd className="text-right tabular-nums">{job.costBudget === null ? "—" : t("reports.explorer.jobs.budgetUsedAmount", { amount: money(job.costBudget), pct: job.budgetUsedPct ?? 0 })}</dd>
                        <dt className="text-on-surface-muted">{t("reports.common.margin")}</dt>
                        <dd className="text-right tabular-nums">{money(job.margin)}</dd>
                      </dl>
                    );
                  }}
                  aria-label={t("reports.explorer.jobs.chartTitle")}
                  description={t("reports.explorer.jobs.chartDescription")}
                />
                {report.jobs.length > CHART_JOBS && (
                  <p className="mt-2 text-[12px] text-on-surface-muted">
                    {t("reports.explorer.jobs.showing", { shown: CHART_JOBS, total: report.jobs.length })}
                  </p>
                )}
              </ReportChart>
            )}
            <div data-testid="job-profitability-table">
              <DataTable
                columns={columns}
                data={report.jobs}
                rowKey={(job) => job.jobId}
                searchPlaceholder={t("reports.explorer.jobs.search")}
                searchKey={(job) => job.name}
                configurablePageSize
                footer={report.jobs.length ? { job: t("reports.common.total"), contract: money(totals.contract), billed: money(totals.billed), revenue: money(totals.revenue), cost: money(totals.cost), margin: money(totals.margin) } : undefined}
              />
            </div>
            <ReportFootnote>{t("reports.explorer.jobs.footnote")}</ReportFootnote>
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
  const t = useT();
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
                <p className="py-4 text-[13px] text-on-surface-muted">{t("reports.explorer.drilldown.empty")}</p>
              ) : (
                report.entries.map((entry) => {
                  const route = SOURCE_TYPE_ROUTES[entry.sourceType]?.(entry.sourceId);
                  const label = entry.narration ?? `${entry.sourceType} ${entry.sourceId}`;
                  const amount = entry.debit !== "0" ? entry.debit : entry.credit;
                  const side = entry.debit !== "0" ? t("reports.common.debitSide") : t("reports.common.creditSide");
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
                        <span className="text-[11px] text-on-surface-muted">{new Date(entry.date).toLocaleDateString(orgLocaleTag())}</span>
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
  const t = useT();
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
    { key: "code", header: t("reports.common.code"), render: (line) => <span className="tabular-nums text-on-surface-muted">{line.code}</span>, sortValue: (line) => line.code },
    {
      key: "account",
      header: t("reports.common.account"),
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
    { key: "debit", header: t("reports.common.debit"), align: "right", render: (line) => <span className="tabular-nums">{money(line.debit)}</span>, sortValue: (line) => BigInt(line.debit) },
    { key: "credit", header: t("reports.common.credit"), align: "right", render: (line) => <span className="tabular-nums">{money(line.credit)}</span>, sortValue: (line) => BigInt(line.credit) },
  ];

  return (
    <>
      <ReportTabs value="trial-balance" tabs={STATEMENT_TABS} />
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <ReportFilter label={t("reports.common.asOf")}>
              <DatePicker value={asOf} onChange={(d) => d && setAsOf(d)} />
            </ReportFilter>
            <ReportFilterCheckbox label={t("reports.explorer.tb.hideZero")} checked={hideZero} onCheckedChange={setHideZero} />
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
            <StatCard label={t("reports.explorer.tb.accounts")} value={String(report.lines.length)} />
            <StatCard label={t("reports.common.totalDebits")} value={formatMoney(BigInt(report.totalDebit), currency)} />
            <StatCard label={t("reports.common.totalCredits")} value={formatMoney(BigInt(report.totalCredit), currency)} />
            <StatCard
              label={t("reports.explorer.tb.difference")}
              value={formatMoney(difference, currency)}
              trend={report.balanced ? { direction: "neutral", label: t("reports.explorer.tb.balancedTrend") } : { direction: "down", label: t("reports.explorer.tb.outOfBalanceTrend") }}
            />
          </ReportKpis>
          {!report.balanced && (
            <Alert variant="critical" data-testid="trial-balance-status">
              <AlertDescription>{t("reports.explorer.tb.outOfBalance", { amount: formatMoney(difference, currency) })}</AlertDescription>
            </Alert>
          )}
          <div data-testid="trial-balance-table">
            <DataTable
              columns={columns}
              data={report.lines}
              rowKey={(line) => line.accountId}
              searchPlaceholder={t("reports.explorer.tb.search")}
              searchKey={(line) => `${line.code} ${line.name}`}
              onSearchChange={setSearch}
              configurablePageSize
              pageSizeOptions={[50, 100, 250]}
              footer={{ account: t("reports.common.total"), debit: formatMoney(BigInt(report.totalDebit), currency), credit: formatMoney(BigInt(report.totalCredit), currency) }}
            />
          </div>
          {report.balanced && <ReportFootnote data-testid="trial-balance-status">{t("reports.explorer.tb.balanced")}</ReportFootnote>}
          {canDrill && <ReportFootnote>{t("reports.explorer.tb.drillNote")}</ReportFootnote>}
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
  const t = useT();
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
  const showToast = useToast();

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
              {report && isOwner && <Button onClick={() => setPaymentOpen(true)}>{t("reports.explorer.tax.recordPayment")}</Button>}
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
            <StatCard label={t("reports.explorer.tax.collected")} value={money(report.taxCollected)} trend={{ direction: "neutral", label: t("reports.explorer.tax.collectedHint") }} />
            <StatCard label={t("reports.explorer.tax.paid")} value={money(report.taxPaid)} trend={{ direction: "neutral", label: t("reports.explorer.tax.paidHint") }} />
            <StatCard label={t("reports.explorer.tax.netPayable")} value={money(report.netTaxPayable)} trend={{ direction: "neutral", label: t("reports.explorer.tax.netPayableHint") }} />
            {/* US-RPT-37: tax payments recorded for the range (US-TAX-08). */}
            <StatCard label={t("reports.explorer.tax.paidToAuthority")} value={money(report.payments.paid)} trend={{ direction: "neutral", label: t("reports.explorer.tax.stillToPay", { amount: money(report.payments.stillToPay) }) }} />
          </ReportKpis>

          {/* US-RPT-37: collected, paid and net by tax type. */}
          <StatementTable
            data-testid="tax-summary-by-type"
            columns={[
              { key: "name", header: t("reports.explorer.tax.taxType") },
              { key: "collected", header: t("reports.explorer.tax.collectedColumn"), align: "right" },
              { key: "paid", header: t("reports.explorer.tax.paidColumn"), align: "right" },
              { key: "net", header: t("reports.explorer.tax.netColumn"), align: "right" },
            ]}
            rows={[
              ...(report.byTaxType.rows.length === 0 ? [{ kind: "empty" as const, key: "none", label: t("reports.explorer.tax.noTaxByType") }] : []),
              ...report.byTaxType.rows.map((row) => ({ kind: "line" as const, key: row.taxType, cells: { name: row.label, collected: money(row.collected), paid: money(row.paid), net: money(row.net) } })),
              { kind: "total", key: "total", cells: { name: t("reports.common.total"), collected: money(report.byTaxType.total.collected), paid: money(report.byTaxType.total.paid), net: money(report.byTaxType.total.net) } },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatementTable
              data-testid="tax-summary-table"
              columns={[
                { key: "name", header: t("reports.explorer.tax.collectedByRate") },
                { key: "taxable", header: t("reports.common.taxableAmount"), align: "right" },
                { key: "tax", header: t("reports.common.tax"), align: "right" },
              ]}
              rows={[
                ...(report.collectedByRate.length === 0 && !report.adjustments ? [{ kind: "empty" as const, key: "none", label: t("reports.explorer.tax.noTaxCollected") }] : []),
                ...report.collectedByRate.map((row) => ({ kind: "line" as const, key: row.name, cells: { name: row.name, taxable: money(row.taxableAmount), tax: money(row.amount) } })),
                ...(report.adjustments
                  ? [{ kind: "line" as const, key: "adjustments", cells: { name: t("reports.explorer.tax.collectedAdjustments"), taxable: money(report.adjustments.taxableAmount), tax: money(report.adjustments.amount) } }]
                  : []),
                { kind: "total", key: "total", cells: { name: t("reports.explorer.tax.totalCollected"), taxable: money(report.totalTaxable), tax: money(report.taxCollected) } },
              ]}
            />
            <StatementTable
              data-testid="tax-summary-paid"
              columns={[
                { key: "name", header: t("reports.explorer.tax.paidByRate") },
                { key: "taxable", header: t("reports.common.taxableAmount"), align: "right" },
                { key: "tax", header: t("reports.common.tax"), align: "right" },
              ]}
              rows={[
                ...(report.paidByRate.length === 0 && !report.paidAdjustments ? [{ kind: "empty" as const, key: "none", label: t("reports.explorer.tax.noTaxPaid") }] : []),
                ...report.paidByRate.map((row) => ({ kind: "line" as const, key: row.name, cells: { name: row.name, taxable: money(row.taxableAmount), tax: money(row.amount) } })),
                ...(report.paidAdjustments
                  ? [{ kind: "line" as const, key: "adjustments", cells: { name: t("reports.explorer.tax.paidAdjustments"), taxable: "—", tax: money(report.paidAdjustments.amount) } }]
                  : []),
                { kind: "total", key: "total", cells: { name: t("reports.explorer.tax.totalPaid"), taxable: money(report.totalPaidTaxable), tax: money(report.taxPaid) } },
              ]}
            />
          </div>

          {/* US-RPT-37 (D-147): supplies that carry no tax, by class. */}
          <StatementTable
            data-testid="tax-summary-supply-class"
            columns={[
              { key: "name", header: t("reports.explorer.tax.supplyClass") },
              { key: "sales", header: t("reports.explorer.tax.sales"), align: "right" },
              { key: "purchases", header: t("reports.explorer.tax.purchases"), align: "right" },
            ]}
            rows={report.bySupplyClass.map((row) => ({ kind: "line" as const, key: row.supplyClass, cells: { name: row.label, sales: money(row.sales), purchases: money(row.purchases) } }))}
          />
          {isOwner && <TaxPaymentsList from={report.from} to={report.to} currency={currency} version={paymentsVersion} onChanged={() => setPaymentsVersion((v) => v + 1)} />}
          <ReportFootnote>{t("reports.explorer.tax.footnote")}</ReportFootnote>
          <TaxPaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            reportFrom={report.from}
            reportTo={report.to}
            currency={currency}
            onRecorded={(payment) => {
              setPaymentsVersion((v) => v + 1);
              const total = BigInt(payment.amount) + BigInt(payment.inputTaxUsed);
              if (payment.kind === "payment") showToast(t("reports.explorer.tax.paymentRecorded"), t("reports.explorer.tax.paymentRecordedDescription", { amount: formatMoney(total, currency) }));
              else showToast(t("reports.explorer.tax.refundRecorded"), t("reports.explorer.tax.refundRecordedDescription", { amount: formatMoney(payment.amount, currency) }));
            }}
          />
        </>
      )}
    </>
  );
}
