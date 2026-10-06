"use client";

import { useEffect, useState } from "react";
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
import { budgetUsedLabel } from "@spine/shared";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { TaxPaymentDialog, TaxPaymentsList } from "./tax-payment-dialog";
import { useEntityToast } from "../payments/entity-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
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

function ownerOnlyMessage(err: unknown): string {
  return err instanceof ApiError && err.status === 403
    ? "Owner-only report."
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
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onDrilldown!(line.accountId!, line.code, line.name)}
        className={clickable ? "text-left text-on-surface hover:text-primary hover:underline" : "text-left text-on-surface"}
      >
        {line.code ? `${line.code} — ${line.name}` : line.name}
      </button>
      <span className={`tabular-nums ${negative ? "text-overdue" : "text-on-surface"}`}>
        {formatMoney(amount, currency)}
      </span>
    </div>
  );
}

export function ProfitAndLossTab() {
  const [from, setFrom] = useState<Date>(startOfYear());
  const [to, setTo] = useState<Date>(endOfToday());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProfitAndLossReport>(`/reports/profit-and-loss?from=${toDateParam(from)}&to=${toDateParam(to)}`);
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
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        {!error && (
          <a
            href={`${API_URL}/reports/profit-and-loss/export.csv?from=${toDateParam(from)}&to=${toDateParam(to)}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Export CSV
          </a>
        )}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <div className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Income</p>
            {report.income.length === 0 ? (
              <p className="py-1.5 text-[13px] text-on-surface-muted">No income posted in this range.</p>
            ) : (
              report.income.map((line) => <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />)
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
              report.expenses.map((line) => <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />)
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

export function BalanceSheetTab() {
  const [asOf, setAsOf] = useState<Date>(endOfToday());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<BalanceSheetReport>(`/reports/balance-sheet?asOf=${toDateParam(asOf)}`);
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
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        {!error && (
          <a
            href={`${API_URL}/reports/balance-sheet/export.csv?asOf=${toDateParam(asOf)}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Export CSV
          </a>
        )}
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <div className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Assets</p>
            {report.assets.map((line) => (
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />
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
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />
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
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={line.accountId ? (accountId, code, name) => setDrilldown({ accountId, code, name }) : undefined} />
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
      .catch((err) => setError(ownerOnlyMessage(err)));
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
        <a href={`${API_URL}/reports/job-profitability/export.csv?status=${status}`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-primary hover:underline">
          Export CSV
        </a>
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
      .catch((err) => setError(ownerOnlyMessage(err)));
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
          {!error && (
            <a
              href={`${API_URL}/reports/trial-balance/export.csv?asOf=${toDateParam(asOf)}&includeZero=${!hideZero}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Export CSV
            </a>
          )}
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
                      <button
                        type="button"
                        className="text-left text-primary hover:underline"
                        onClick={() => setDrilldown({ accountId: line.accountId, code: line.code, name: line.name })}
                      >
                        {line.name}
                      </button>
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
  const [from, setFrom] = useState<Date>(() => new Date(new Date().getFullYear(), 0, 1));
  const [to, setTo] = useState<Date>(endOfToday());
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
        {!error && (
          <a
            href={`${API_URL}/org/tax/summary/export.csv?from=${toDateParam(from)}&to=${toDateParam(to)}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Export CSV
          </a>
        )}
        {report && !error && (
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
          <TaxPaymentsList from={report.from} to={report.to} currency={currency} version={paymentsVersion} onChanged={() => setPaymentsVersion((v) => v + 1)} />
          <p className="text-[12px] text-on-surface-muted">Spine produces the numbers for your return; it doesn&apos;t file it. Only owners can see this report.</p>
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
