import { cn } from "../lib/cn";

export interface SegmentedBarSegment {
  key: string;
  label: string;
  /** Any unit; only the proportions matter. */
  value: number;
  /** Shown in the legend, e.g. "$4,542.50". */
  formattedValue: string;
  /** A theme token, e.g. `var(--color-overdue)`. */
  color: string;
}

export interface SegmentedBarProps {
  segments: SegmentedBarSegment[];
  /** Names the bar for screen readers, e.g. "Receivables by age". */
  "aria-label": string;
  /** Shown instead of the bar when every value is zero. */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * One bar split into parts — e.g. what's owed by age — with a text legend
 * of every part's amount and share, so colour is never the only signal.
 */
export function SegmentedBar({ segments, "aria-label": ariaLabel, emptyState, className }: SegmentedBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const share = (value: number) => (total > 0 ? (Math.max(0, value) / total) * 100 : 0);
  const percent = (value: number) => `${share(value).toFixed(share(value) > 0 && share(value) < 1 ? 1 : 0)}%`;
  if (total === 0) {
    return <div className={cn("flex h-16 items-center justify-center text-[13px] text-on-surface-muted", className)}>{emptyState ?? "Nothing to show."}</div>;
  }
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${s.formattedValue}`).join(", ")}`} className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.key} className="h-full border-r-2 border-surface last:border-r-0" style={{ width: `${share(s.value)}%`, backgroundColor: s.color }} />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3 lg:grid-cols-5">
        {segments.map((s) => (
          <li key={s.key} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-on-surface-muted">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums font-medium text-on-surface">
              {s.formattedValue} <span className="font-normal text-on-surface-muted">· {percent(s.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
