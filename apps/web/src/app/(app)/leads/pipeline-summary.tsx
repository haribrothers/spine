"use client";

import { cn } from "@spine/ui";
import { formatMoney } from "../../../lib/money";
import type { PipelineSummary } from "./pipeline-state";

function Totals({ totals, fallbackCurrency }: { totals: [string, bigint][]; fallbackCurrency: string }) {
  if (totals.length === 0) return <>{formatMoney(0n, fallbackCurrency)}</>;
  return (
    <>
      {totals.map(([currency, total]) => (
        <span key={currency} className="block">
          {formatMoney(total, currency)}
        </span>
      ))}
    </>
  );
}

const leadsCount = (n: number) => `${n} ${n === 1 ? "lead" : "leads"}`;

/**
 * US-CRM-24 (D-211) — the strip above the board: open pipeline, won this
 * month, win rate (last 90 days) and overdue follow-ups, which filters the
 * board when pressed.
 */
export function PipelineSummaryStrip({
  summary,
  currency,
  overdueActive,
  onOverdueToggle,
}: {
  summary: PipelineSummary;
  /** The organisation's currency, for a zero total. */
  currency: string;
  overdueActive: boolean;
  onOverdueToggle: () => void;
}) {
  const figure = "flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 text-left";
  const label = "text-[12.5px] font-medium text-on-surface-muted";
  const value = "text-[20px] font-bold leading-tight tabular-nums text-on-surface";
  const note = "text-[12px] text-on-surface-muted";
  const { winRate } = summary;

  return (
    <section aria-label="Pipeline summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="pipeline-summary">
      <div className={figure} data-testid="summary-open">
        <span className={label}>Open pipeline</span>
        <span className={value}>
          <Totals totals={summary.open.totals} fallbackCurrency={currency} />
        </span>
        <span className={note}>{leadsCount(summary.open.count)}</span>
      </div>
      <div className={figure} data-testid="summary-won">
        <span className={label}>Won this month</span>
        <span className={value}>
          <Totals totals={summary.wonThisMonth.totals} fallbackCurrency={currency} />
        </span>
        <span className={note}>{leadsCount(summary.wonThisMonth.count)}</span>
      </div>
      <div className={figure} data-testid="summary-win-rate">
        <span className={label}>Win rate</span>
        <span className={value}>{winRate.rate === null ? "—" : `${winRate.rate}%`}</span>
        <span className={note}>{winRate.closed === 0 ? "None closed in the last 90 days" : `${winRate.won} of ${winRate.closed} closed in the last 90 days`}</span>
      </div>
      <button
        type="button"
        aria-pressed={overdueActive}
        onClick={onOverdueToggle}
        aria-label={`${overdueActive ? "Show all leads" : "Show leads with overdue follow-ups"}, ${summary.overdue}`}
        className={cn(
          figure,
          "transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          overdueActive && "border-primary bg-info-bg hover:bg-info-bg",
        )}
        data-testid="summary-overdue"
      >
        <span className={label}>Overdue follow-ups</span>
        <span className={cn(value, summary.overdue > 0 && "text-overdue")}>{summary.overdue}</span>
        <span className="text-[12px] font-medium text-primary">{overdueActive ? "Show all leads" : "Show these leads"}</span>
      </button>
    </section>
  );
}
