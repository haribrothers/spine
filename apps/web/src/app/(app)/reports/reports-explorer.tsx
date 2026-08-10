"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { apiClient, ApiError } from "../../../lib/api-client";
import {
  SOURCE_TYPE_ROUTES,
  type AccountDrilldownReport,
  type BalanceSheetReport,
  type JobProfitabilityReport,
  type ProfitAndLossReport,
  type ReportAccountLine,
} from "./types";

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

/**
 * S-09.2/S-09.3/S-09.4/S-09.6/S-09.7 — the Reports page's client body.
 * Three tabs (P&L, Balance Sheet, Job Profitability), each independently
 * loaded — a Staff user with `dashboard.view` but not Owner sees Job
 * Profitability load fine and P&L/Balance Sheet show the real 403 inline
 * (same "no client-side capability check, surface the server's real
 * error" convention as tax-pane.tsx's own TaxSummarySection), rather than
 * hiding the tabs entirely.
 */
export function ReportsExplorer() {
  return (
    <Tabs defaultValue="pl">
      <TabsList>
        <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>
        <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
        <TabsTrigger value="jobs">Job Profitability</TabsTrigger>
      </TabsList>
      <TabsContent value="pl">
        <ProfitAndLossTab />
      </TabsContent>
      <TabsContent value="bs">
        <BalanceSheetTab />
      </TabsContent>
      <TabsContent value="jobs">
        <JobProfitabilityTab />
      </TabsContent>
    </Tabs>
  );
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
      <span className={`font-mono tabular-nums ${negative ? "text-overdue" : "text-on-surface"}`}>
        {toDecimalString({ amount, currency })} {currency}
      </span>
    </div>
  );
}

function ProfitAndLossTab() {
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
        <div className="flex flex-col gap-4 rounded-md border border-border-strong p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Income</p>
            {report.income.length === 0 ? (
              <p className="py-1.5 text-[13px] text-on-surface-muted">No income posted in this range.</p>
            ) : (
              report.income.map((line) => <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />)
            )}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total income</span>
              <span className="font-mono tabular-nums">
                {toDecimalString({ amount: BigInt(report.totalIncome), currency })} {currency}
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
              <span className="font-mono tabular-nums">
                {toDecimalString({ amount: BigInt(report.totalExpenses), currency })} {currency}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-strong pt-3 text-[15px] font-semibold">
            <span>Net profit</span>
            <span className="font-mono tabular-nums">
              {toDecimalString({ amount: BigInt(report.netProfit), currency })} {currency}
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

function BalanceSheetTab() {
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
        <div className="flex flex-col gap-4 rounded-md border border-border-strong p-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Assets</p>
            {report.assets.map((line) => (
              <AccountLineRow key={line.code} line={line} currency={currency} onDrilldown={(accountId, code, name) => setDrilldown({ accountId, code, name })} />
            ))}
            <div className="flex items-center justify-between pt-1.5 text-[13px] font-semibold">
              <span>Total assets</span>
              <span className="font-mono tabular-nums">
                {toDecimalString({ amount: BigInt(report.totalAssets), currency })} {currency}
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
              <span className="font-mono tabular-nums">
                {toDecimalString({ amount: BigInt(report.totalLiabilities), currency })} {currency}
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
              <span className="font-mono tabular-nums">
                {toDecimalString({ amount: BigInt(report.totalEquity), currency })} {currency}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-strong pt-3 text-[15px] font-semibold">
            <span>Total liabilities + equity</span>
            <span className="font-mono tabular-nums">
              {toDecimalString({ amount: BigInt(report.totalLiabilitiesAndEquity), currency })} {currency}
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

function JobProfitabilityTab() {
  const [report, setReport] = useState<JobProfitabilityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<JobProfitabilityReport>("/reports/job-profitability")
      .then(setReport)
      .catch((err) => setError(ownerOnlyMessage(err)));
  }, []);

  if (error) {
    return (
      <div className="pt-4">
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex justify-end">
        <a href={`${API_URL}/reports/job-profitability/export.csv`} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-primary hover:underline">
          Export CSV
        </a>
      </div>
      {report.jobs.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No jobs yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border-strong">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-secondary text-left text-on-surface-muted">
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Contract value</th>
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
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {toDecimalString({ amount: BigInt(job.contractValueAmount), currency: job.currency })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{toDecimalString({ amount: BigInt(job.revenue), currency: job.currency })}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{toDecimalString({ amount: BigInt(job.cost), currency: job.currency })}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{toDecimalString({ amount: BigInt(job.margin), currency: job.currency })}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{job.marginPct === null ? "—" : `${job.marginPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** S-09.4 — the click-through-to-source-documents dialog behind any P&L/Balance Sheet figure. */
function DrilldownDialog({
  accountId,
  accountLabel,
  from,
  to,
  currency,
  onClose,
}: {
  accountId: string;
  accountLabel: string;
  from: string;
  to: string;
  currency: string;
  onClose: () => void;
}) {
  const [report, setReport] = useState<AccountDrilldownReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AccountDrilldownReport>(`/reports/account-drilldown?accountId=${accountId}&from=${from}&to=${to}`)
      .then(setReport)
      .catch((err) => setError(ownerOnlyMessage(err)));
  }, [accountId, from, to]);

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
                      <span className="font-mono tabular-nums text-on-surface-muted">
                        {side} {toDecimalString({ amount: BigInt(amount), currency })} {currency}
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
