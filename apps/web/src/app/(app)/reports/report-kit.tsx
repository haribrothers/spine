"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, cn, DatePicker, ReportFilter } from "@spine/ui";
import { apiClient, ApiError } from "../../../lib/api-client";

/**
 * US-RPT-40 — the pieces every report page is built from, in page order:
 * `ReportToolbar` (from @spine/ui) with `RangeFilters`, `ReportKpis`,
 * `ReportChart`, the table, `ReportFootnote`.
 */

/** P&L, Balance Sheet, Trial Balance and Cash Flow share one set of tabs. */
export const STATEMENT_TABS = [
  { value: "profit-and-loss", label: "Profit & Loss", href: "/reports/profit-and-loss" },
  { value: "balance-sheet", label: "Balance Sheet", href: "/reports/balance-sheet" },
  { value: "trial-balance", label: "Trial Balance", href: "/reports/trial-balance" },
  { value: "cash-flow", label: "Cash Flow", href: "/reports/cash-flow" },
];

/**
 * Loads a report and reloads whenever its URL (its filters) changes — the
 * filters apply as they change, so there's no Refresh. The figures on
 * screen stay put while the next ones load; a late answer to an older
 * request is dropped. `refused` is the message for a 403.
 */
export function useReport<T>(url: string | null, refused?: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: url !== null });
  useEffect(() => {
    if (!url) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    apiClient.get<T>(url).then(
      (data) => live && setState({ data, error: null, loading: false }),
      (err) =>
        live &&
        setState({
          data: null,
          error: err instanceof ApiError && err.status === 403 && refused ? refused : err instanceof Error ? err.message : "This report didn't load. Try again.",
          loading: false,
        }),
    );
    return () => {
      live = false;
    };
  }, [url, refused]);
  return state;
}

/** From and To, labelled, for a `ReportToolbar`. */
export function RangeFilters({ from, to, onFrom, onTo }: { from: Date; to: Date; onFrom: (d: Date) => void; onTo: (d: Date) => void }) {
  return (
    <>
      <ReportFilter label="From">
        <DatePicker value={from} onChange={(d) => d && onFrom(d)} />
      </ReportFilter>
      <ReportFilter label="To">
        <DatePicker value={to} onChange={(d) => d && onTo(d)} />
      </ReportFilter>
    </>
  );
}

/** One row of equal-width KPI cards: three or four. */
export function ReportKpis({ children, count, "data-testid": testId }: { children: React.ReactNode; count: 3 | 4; "data-testid"?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")} data-testid={testId ?? "report-kpis"} data-slot="report-kpis">
      {children}
    </div>
  );
}

/** The report's one chart, in a card under the KPI cards. */
export function ReportChart({ title, children, "data-testid": testId }: { title: string; children: React.ReactNode; "data-testid"?: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-[15px]">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** One muted line under the table: what the figures are, or the check they pass. */
export function ReportFootnote({ children, "data-testid": testId }: { children: React.ReactNode; "data-testid"?: string }) {
  return (
    <p className="text-[13px] text-on-surface-muted" data-testid={testId}>
      {children}
    </p>
  );
}

/** "38.2%" — net profit as a share of income, or "—" with no income. */
export function marginText(netProfit: string | bigint, income: string | bigint): string {
  const inc = BigInt(income);
  if (inc === 0n) return "—";
  const tenths = (BigInt(netProfit) * 1000n) / inc;
  const sign = tenths < 0n ? "−" : "";
  const abs = tenths < 0n ? -tenths : tenths;
  return `${sign}${abs / 10n}.${abs % 10n}%`;
}
