"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  GroupedBarChart,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatCard,
  ToggleGroup,
  ToggleGroupItem,
} from "@spine/ui";
import Link from "next/link";
import { apiClient, ApiError } from "../../../lib/api-client";
import {
  SOURCE_TYPE_ROUTES,
  type AccountDrilldownReport,
  type BalanceSheetReport,
  type JobProfitabilityReport,
  type ProfitAndLossReport,
  type ReportAccountLine,
  type TaxSummaryReport,
  type TrialBalanceReport,
} from "./types";
import { formatMoney } from "../../../lib/money";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { budgetUsedLabel, FINANCIAL_STATEMENTS_NO_ACCESS, PL_COMPARE_LABELS, PL_COMPARE_MODES, changePercent, periodLabel, previousYearEnd, type PlCompareMode } from "@spine/shared";
import { BsCompareTable, PlCompareTable } from "./compare-tables";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { TaxPaymentDialog, TaxPaymentsList } from "./tax-payment-dialog";
import { useEntityToast } from "../payments/entity-toast";

/** The local calendar date (toISOString would shift it a day in time zones ahead of UTC). */
function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "▲ 11.6% vs previous period" for a card; words and an arrow, not colour alone. */
function cardTrend(current: string, previous: string, against: string): { direction: "up" | "down" | "neutral"; label: string } {
  const pct = changePercent(BigInt(current), BigInt(previous));
  if (pct === null) return { direction: "neutral", label: `nothing to compare ${against}` };
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

function ownerOnlyMessage(err: unknown, refused: string = FINANCIAL_STATEMENTS_NO_ACCESS): string {
  return err instanceof ApiError && err.status === 403
    ? refused
    : err instanceof Error
      ? err.message
      : "Could not load this report.";
}

function AccountLineRow({
  line,
  currency,
  onDrilldown,
}: {
  line: ReportAccountLine;
  currency: string;
  onDrilldown?: (accountId: string, code: string, name: string) => void;
}) {
  const amount = BigInt(line.amount);
  const negative = amount < 0n;
  const clickable = Boolean(line.accountId && onDrilldown);
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-[13px] last:border-b-0">
      {clickable ? (
        <button type="button" onClick={() => onDrilldown!(line.accountId!, line.code, line.name)} className="text-left text-on-surface hover:text-primary hover:underline">
          {line.code ? `${line.code} — ${line.name}` : line.name}
        </button>
      ) : (
        <span className="text-left text-on-surface">{line.code ? `${line.code} — ${line.name}` : line.name}</span>
      )}
      <span className={`tabular-nums ${negative ? "text-overdue" : "text-on-surface"}`}>
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

export function ProfitAndLossTab() {
  const canDrill = useCanDrill();
  const [from, setFrom] = useState<Date>(startOfYear());
  const [to, setTo] = useState<Date>(endOfToday());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ accountId: string; code: string; name: string } | null>(null);
  const [compare, setCompare] = useState<"none" | PlCompareMode>("none");
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, []);

  async function load(mode = compare, on = basis) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProfitAndLossReport>(`/reports/profit-and-loss?from=${toDateParam(from)}&to=${toDateParam(to)}${mode === "none" ? "" : `&compare=${mode}`}${on === "cash" ? "&basis=cash" : ""}`);
      setReport(res);
    } catch (err) {
      setError(ownerOnlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="pl-compare-label">Compare with</Label>
          <Select
            value={compare}
            onValueChange={(v) => {
              setCompare(v as typeof compare);
              void load(v as typeof compare);
            }}
          >
            <SelectTrigger className="w-56" aria-labelledby="pl-compare-label">
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
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="pl-basis-label">Basis</Label>
          <ToggleGroup
            type="single"
            value={basis}
            onValueChange={(v) => {
              if (!v) return;
              setBasis(v as typeof basis);
              void load(compare, v as typeof basis);
            }}
            aria-labelledby="pl-basis-label"
            className="rounded-md bg-surface-sunken p-1"
          >
            <ToggleGroupItem value="accrual" className="px-3 data-[state=on]:bg-surface data-[state=on]:text-on-surface data-[state=on]:shadow-sm">
              Accrual
            </ToggleGroupItem>
            <ToggleGroupItem value="cash" className="px-3 data-[state=on]:bg-surface data-[state=on]:text-on-surface data-[state=on]:shadow-sm">
              Cash
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        {!error && <ReportExportMenu path={`/reports/profit-and-loss?from=${toDateParam(from)}&to=${toDateParam(to)}${compare === "none" ? "" : `&compare=${compare}`}${basis === "cash" ? "&basis=cash" : ""}`} />}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report?.comparison && !error && (
        <div className="flex flex-col gap-4" data-testid="pl-comparison">
          <p className="text-[14px] text-on-surface-muted" data-testid="pl-compare-subtitle">
            {report.comparison.mode === "monthly"
              ? `${periodLabel(report.from, report.to)} by month`
              : `${periodLabel(report.from, report.to)} compared with ${report.comparison.columns[1]!.label}`}
            {report.basis === "cash" ? " · Cash basis" : " · Accrual basis"}
          </p>
          {report.comparison.mode !== "monthly" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(
                [
                  ["Total income", report.comparison.totalIncome],
                  ["Total expenses", report.comparison.totalExpenses],
                  ["Net profit", report.comparison.netProfit],
                ] as const
              ).map(([label, amounts]) => (
                <StatCard
                  key={label}
                  label={label}
                  value={formatMoney(BigInt(amounts[0]!), currency)}
                  trend={cardTrend(amounts[0]!, amounts[1]!, report.comparison!.mode === "previous" ? "vs previous period" : "vs last year")}
                />
              ))}
            </div>
          )}
          <PlCompareTable comparison={report.comparison} totals={{ income: report.totalIncome, expenses: report.totalExpenses, netProfit: report.netProfit }} currency={currency} />
          <p className="text-[13px] text-on-surface-muted">Arrows and signs show direction; colour is never the only signal. Choose &quot;Each month&quot; for one column per month plus a total.</p>
        </div>
      )}

      {report?.basis === "cash" && !report.comparison && !error && <CashBasisView report={report} currency={currency} />}
      {report?.basis === "cash" && report.comparison && !error && <CashBasisNotes report={report} />}

      {report && report.basis !== "cash" && !report.comparison && !error && (
        <div className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Income</p>
            {report.income.length === 0 ? (
              <p className="py-1.5 text-[13px] text-on-surface-muted">No income posted in this range.</p>
            ) : (
              report.income.map((line) => <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={canDrill ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />)
            )}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total income</span>
              <span className="tabular-nums">
                {formatMoney(BigInt(report.totalIncome), currency)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Expenses</p>
            {report.expenses.length === 0 ? (
              <p className="py-1.5 text-[13px] text-on-surface-muted">No expenses posted in this range.</p>
            ) : (
              report.expenses.map((line) => <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={canDrill ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />)
            )}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total expenses</span>
              <span className="tabular-nums">
                {formatMoney(BigInt(report.totalExpenses), currency)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-strong pt-3 text-[15px] font-semibold">
            <span>Net profit</span>
            <span className="tabular-nums">
              {formatMoney(BigInt(report.netProfit), currency)}
            </span>
          </div>
        </div>
      )}

      {drilldown && (
        <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from={toDateParam(from)} to={toDateParam(to)} currency={currency} onClose={() => setDrilldown(null)} />
      )}
    </div>
  );
}

/** US-RPT-35 — what the cash basis leaves out, and how it's worked out. */
function CashBasisNotes({ report }: { report: ProfitAndLossReport }) {
  const excluded = report.openingExcluded;
  return (
    <div className="flex flex-col gap-3" data-testid="cash-basis-notes">
      {excluded && BigInt(excluded.invoices) > 0n && (
        <p className="rounded-md bg-surface-sunken px-4 py-3 text-[14px] text-on-surface">
          Payments on invoices from before {new Date(`${excluded.cutoverDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} aren&apos;t counted — that income was in your old books.
        </p>
      )}
      {excluded && BigInt(excluded.bills) > 0n && (
        <p className="rounded-md bg-surface-sunken px-4 py-3 text-[14px] text-on-surface">
          Payments on bills from before {new Date(`${excluded.cutoverDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} aren&apos;t counted — those costs were in your old books.
        </p>
      )}
      <p className="text-[13px] text-on-surface-muted">
        Income counts what customers paid in the range and costs what was paid, split across accounts in proportion to each invoice&apos;s or bill&apos;s lines. The Balance Sheet, Trial Balance and Tax Summary stay on the accrual basis.
      </p>
    </div>
  );
}

/** US-RPT-35 — `ReportsPLCashBasis`: Profit & Loss counted as money received and paid. */
function CashBasisView({ report, currency }: { report: ProfitAndLossReport; currency: string }) {
  const money = (v: string) => formatMoney(BigInt(v), currency);
  const rows = [...report.income, ...report.expenses];
  return (
    <div className="flex flex-col gap-4" data-testid="cash-basis">
      <p className="text-[14px] text-on-surface-muted" data-testid="pl-basis-subtitle">
        {periodLabel(report.from, report.to)} · Cash basis
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Cash received (income)" value={money(report.totalIncome)} trend={{ direction: "neutral", label: "paid by customers in the range" }} />
        <StatCard label="Cash paid (expenses)" value={money(report.totalExpenses)} trend={{ direction: "neutral", label: "paid to vendors and staff" }} />
        <StatCard label="Net profit (cash basis)" value={money(report.netProfit)} trend={{ direction: "neutral", label: `accrual basis: ${money(report.accrualNetProfit ?? "0")}` }} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-[14px]" data-testid="cash-basis-table">
          <thead>
            <tr className="border-b border-border text-on-surface">
              <th className="px-4 py-3 text-left font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Cash basis</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="border-b border-border">
                <td colSpan={2} className="px-4 py-3 text-on-surface-muted">
                  Nothing received or paid in this range.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.accountId ?? l.code} className="border-b border-border">
                <td className="px-4 py-2 text-on-surface">
                  {l.code} · {l.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{money(l.amount)}</td>
              </tr>
            ))}
            <tr className="bg-surface-sunken font-semibold text-on-surface">
              <td className="px-4 py-3">Net profit (cash basis)</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(report.netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <CashBasisNotes report={report} />
    </div>
  );
}

export function BalanceSheetTab() {
  const canDrill = useCanDrill();
  const [asOf, setAsOf] = useState<Date>(endOfToday());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ accountId: string; code: string; name: string } | null>(null);
  const [compare, setCompare] = useState<"none" | "previous_year_end">("none");
  const [yearStart, setYearStart] = useState({ month: 1, day: 1 });

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
    apiClient
      .get<{ value: { month: number; day: number } | null }>("/org/settings/financial_year_start")
      .then((res) => res.value && setYearStart(res.value))
      .catch(() => {});
  }, []);

  async function load(mode = compare) {
    setLoading(true);
    setError(null);
    try {
      const date = toDateParam(asOf);
      const res = await apiClient.get<BalanceSheetReport>(`/reports/balance-sheet?asOf=${date}${mode === "none" ? "" : `&compareAsOf=${previousYearEnd(date, yearStart)}`}`);
      setReport(res);
    } catch (err) {
      setError(ownerOnlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>As of</Label>
          <DatePicker value={asOf} onChange={setAsOf} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id="bs-compare-label">Compare with</Label>
          <Select
            value={compare}
            onValueChange={(v) => {
              setCompare(v as typeof compare);
              void load(v as typeof compare);
            }}
          >
            <SelectTrigger className="w-52" aria-labelledby="bs-compare-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No comparison</SelectItem>
              <SelectItem value="previous_year_end">Previous year end</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        {!error && <ReportExportMenu path={`/reports/balance-sheet?asOf=${toDateParam(asOf)}${compare === "none" ? "" : `&compareAsOf=${previousYearEnd(toDateParam(asOf), yearStart)}`}`} />}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report?.comparison && !error && (
        <BsCompareTable report={report} comparison={report.comparison} currency={currency} labels={[periodLabel(report.asOf, report.asOf), periodLabel(report.comparison.asOf, report.comparison.asOf)]} />
      )}

      {report && !report.comparison && !error && (
        <div className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Assets</p>
            {report.assets.map((line) => (
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={canDrill ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />
            ))}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total assets</span>
              <span className="tabular-nums">
                {formatMoney(BigInt(report.totalAssets), currency)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Liabilities</p>
            {report.liabilities.map((line) => (
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={canDrill ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />
            ))}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total liabilities</span>
              <span className="tabular-nums">
                {formatMoney(BigInt(report.totalLiabilities), currency)}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Equity</p>
            {report.equity.map((line) => (
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={line.accountId && canDrill ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />
            ))}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total equity</span>
              <span className="tabular-nums">
                {formatMoney(BigInt(report.totalEquity), currency)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-strong pt-3 text-[15px] font-semibold">
            <span>Total liabilities + equity</span>
            <span className="tabular-nums">
              {formatMoney(BigInt(report.totalLiabilitiesAndEquity), currency)}
            </span>
          </div>
        </div>
      )}

      {drilldown && (
        <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from="2000-01-01" to={toDateParam(asOf)} currency={currency} onClose={() => setDrilldown(null)} />
      )}
    </div>
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
  const [report, setReport] = useState<JobProfitabilityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("active_on_hold");

  useEffect(() => {
    setReport(null);
    apiClient
      .get<JobProfitabilityReport>(`/reports/job-profitability?status=${status}`)
      .then(setReport)
      .catch((err) => setError(ownerOnlyMessage(err, NO_REPORT_ACCESS)));
  }, [status]);

  if (error) {
    return (
      <div className="pt-4">
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const charted = report ? [...report.jobs].sort((a, b) => (BigInt(b.contractValueAmount) > BigInt(a.contractValueAmount) ? 1 : -1)).slice(0, CHART_JOBS) : [];
  const currency = report?.jobs[0]?.currency ?? "USD";
  const money = (minor: string | null) => (minor === null ? "—" : formatMoney(BigInt(minor), currency));
  const compact = new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56" aria-label="Which jobs">
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
        <ReportExportMenu path={`/reports/job-profitability?status=${status}`} />
      </div>
      {!report ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : report.jobs.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No jobs here.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface p-4">
            <h3 className="text-[15px] font-semibold text-on-surface">Contract, billed and cost by job</h3>
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
              <p className="text-[12px] text-on-surface-muted">
                Showing {CHART_JOBS} of {report.jobs.length} jobs — the table lists them all.
              </p>
            )}
          </div>
          <div className="overflow-x-auto rounded-md border border-border-strong bg-surface">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left text-on-surface-muted">
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Contract value</th>
                  <th className="px-3 py-2 text-right font-medium">Billed to date</th>
                  <th className="px-3 py-2 text-right font-medium">Billed %</th>
                  <th className="px-3 py-2 font-medium">Budget used</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {report.jobs.map((job) => (
                  <tr key={job.jobId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/jobs/${job.jobId}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                        {job.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-on-surface-muted">{job.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(job.contractValueAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(job.billedToDate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{job.billedPct === null ? "—" : `${job.billedPct}%`}</td>
                    <td className={`px-3 py-2 tabular-nums ${job.budgetState === "over" ? "text-overdue" : job.budgetState === "near" ? "text-due-soon" : ""}`}>
                      <span className="inline-flex items-center gap-1">
                        {job.budgetState === "over" && <OctagonAlert size={13} aria-hidden />}
                        {job.budgetState === "near" && <AlertTriangle size={13} aria-hidden />}
                        {budgetUsedLabel(job.budgetState, job.budgetUsedPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(job.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(job.cost)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${BigInt(job.margin) < 0n ? "text-overdue" : ""}`}>{money(job.margin)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{job.marginPct === null ? "—" : `${job.marginPct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
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
  const [report, setReport] = useState<AccountDrilldownReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AccountDrilldownReport>(`/reports/account-drilldown?accountId=${accountId}&from=${from}&to=${to}${jobId ? `&jobId=${jobId}` : ""}`)
      .then(setReport)
      .catch((err) => setError(ownerOnlyMessage(err, NO_REPORT_ACCESS)));
  }, [accountId, from, to, jobId]);

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

/**
 * US-RPT-13 — every account's balance as of a date, on its debit or credit
 * side, with matching totals. Click an account for its journal entries.
 */
export function TrialBalanceTab() {
  const canDrill = useCanDrill();
  const [asOf, setAsOf] = useState<Date>(endOfToday());
  const [hideZero, setHideZero] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ accountId: string; code: string; name: string } | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, []);

  async function load(includeZero = !hideZero) {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<TrialBalanceReport>(`/reports/trial-balance?asOf=${toDateParam(asOf)}&includeZero=${includeZero}`));
    } catch (err) {
      setError(ownerOnlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" and the checkbox reload after that.
  }, []);

  const money = (value: string) => (BigInt(value) === 0n ? "—" : formatMoney(value, currency));

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>As of</Label>
            <DatePicker value={asOf} onChange={setAsOf} />
          </div>
          <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Spinner size="sm" /> : "Refresh"}
          </Button>
          {!error && <ReportExportMenu path={`/reports/trial-balance?asOf=${toDateParam(asOf)}&includeZero=${!hideZero}`} />}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-on-surface">
          <Checkbox
            checked={hideZero}
            onCheckedChange={(checked) => {
              setHideZero(checked === true);
              void load(checked !== true);
            }}
          />
          Hide accounts with no balance
        </label>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          {report.balanced ? (
            <Alert variant="success" data-testid="trial-balance-status">
              <AlertDescription>Balanced — total debits equal total credits.</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="critical" data-testid="trial-balance-status">
              <AlertDescription>
                Out of balance by {formatMoney(BigInt(report.totalDebit) - BigInt(report.totalCredit), currency)}.
              </AlertDescription>
            </Alert>
          )}
          <div className="overflow-x-auto rounded-md border border-border-strong bg-surface">
            <table className="w-full text-[13px]" data-testid="trial-balance-table">
              <thead>
                <tr className="border-b border-border text-left text-on-surface-muted">
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 text-right font-medium">Debit</th>
                  <th className="px-4 py-2 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.accountId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-on-surface-muted">{line.code}</td>
                    <td className="px-4 py-2">
                      {canDrill ? (
                        <button
                          type="button"
                          className="text-left text-primary hover:underline"
                          onClick={() => setDrilldown({ accountId: line.accountId, code: line.code, name: line.name })}
                        >
                          {line.name}
                        </button>
                      ) : (
                        <span className="text-on-surface">{line.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(line.debit)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(line.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong font-semibold">
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(BigInt(report.totalDebit), currency)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(BigInt(report.totalCredit), currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[12px] text-on-surface-muted">Click an account to see every journal entry behind its balance.</p>
        </>
      )}

      {drilldown && (
        <DrilldownDialog accountId={drilldown.accountId} accountLabel={`${drilldown.code} — ${drilldown.name}`} from="2000-01-01" to={toDateParam(asOf)} currency={currency} onClose={() => setDrilldown(null)} />
      )}
    </div>
  );
}

/**
 * US-RPT-14 (D-057) — tax collected and paid for a period, with a per-rate
 * breakdown, for filing. Collected is from the ledger (after credit notes
 * and voids); the per-rate rows come from issued invoices' lines (D-031).
 */
export function TaxSummaryTab() {
  // Recording tax payments stays Owner-only (US-TAX-08); reading the summary is "View financial statements" (US-RPT-36).
  const isOwner = useMyRole() === "owner";
  // US-DASH-25 — the dashboard's tax card opens this for its period (?from=&to=).
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const [from, setFrom] = useState<Date>(() => (fromParam ? new Date(`${fromParam}T00:00:00`) : new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState<Date>(() => (toParam ? new Date(`${toParam}T00:00:00`) : endOfToday()));
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<TaxSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // US-TAX-08
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentsVersion, setPaymentsVersion] = useState(0);
  const { show: showToast, toast } = useEntityToast();

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<TaxSummaryReport>(`/org/tax/summary?from=${toDateParam(from)}&to=${toDateParam(to)}`));
    } catch (err) {
      setError(ownerOnlyMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" reloads for new dates.
  }, []);

  const money = (value: string) => formatMoney(value, currency);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        {!error && <ReportExportMenu path={`/org/tax/summary?from=${toDateParam(from)}&to=${toDateParam(to)}`} />}
        {report && !error && isOwner && (
          <Button size="sm" className="sm:ml-auto" onClick={() => setPaymentOpen(true)}>
            Record tax payment
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="tax-summary-cards">
            {[
              { label: "Tax collected", value: report.taxCollected, note: "On issued invoices, after credit notes" },
              { label: "Tax paid", value: report.taxPaid, note: "On recorded vendor bills and approved expenses" },
              { label: "Net payable", value: report.netTaxPayable, note: "Collected minus paid" },
            ].map((card) => (
              <div key={card.label} className="rounded-md border border-border-strong bg-surface p-4">
                <p className="text-[13px] text-on-surface-muted">{card.label}</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums text-on-surface">
                  {money(card.value)}
                </p>
                <p className="mt-1 text-[12px] text-on-surface-muted">{card.note}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border-strong bg-surface">
            <table className="w-full text-[13px]" data-testid="tax-summary-table">
              <thead>
                <tr className="border-b border-border text-left text-on-surface-muted">
                  <th className="px-4 py-2 font-medium">Collected by rate</th>
                  <th className="px-4 py-2 text-right font-medium">Taxable amount</th>
                  <th className="px-4 py-2 text-right font-medium">Tax</th>
                </tr>
              </thead>
              <tbody>
                {report.collectedByRate.map((row) => (
                  <tr key={row.name} className="border-b border-border">
                    <td className="px-4 py-2">{row.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(row.taxableAmount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(row.amount)}</td>
                  </tr>
                ))}
                {report.adjustments && (
                  <tr className="border-b border-border">
                    <td className="px-4 py-2">Adjustments from credit notes and voided invoices</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(report.adjustments.taxableAmount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(report.adjustments.amount)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong font-semibold">
                  <td className="px-4 py-2">Total collected</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {money(report.totalTaxable)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {money(report.taxCollected)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {isOwner && <TaxPaymentsList from={report.from} to={report.to} currency={currency} version={paymentsVersion} onChanged={() => setPaymentsVersion((v) => v + 1)} />}
          <p className="text-[12px] text-on-surface-muted">Spine produces the numbers for your return; it doesn&apos;t file it. Owners, and members with &quot;View financial statements&quot;, can see this report.</p>
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
    </div>
  );
}
