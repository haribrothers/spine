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
  /**
   * US-PAY-29 — makes each part pressable (a legend button, and the bar
   * itself by pointer) to filter by it. Parts not in `selectedKeys` fade
   * on the bar; a single selected part is also marked pressed in the
   * legend (several — "every overdue age" — only fade the rest).
   */
  onSegmentClick?: (key: string) => void;
  selectedKeys?: readonly string[];
}

/**
 * One bar split into parts — e.g. what's owed by age — with a text legend
 * of every part's amount and share, so colour is never the only signal.
 */
export function SegmentedBar({ segments, "aria-label": ariaLabel, emptyState, className, onSegmentClick, selectedKeys }: SegmentedBarProps) {
  const chosen = selectedKeys && selectedKeys.length > 0 ? new Set(selectedKeys) : null;
  const pressedKey = selectedKeys && selectedKeys.length === 1 ? selectedKeys[0] : null;
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
            <div
              key={s.key}
              onClick={onSegmentClick ? () => onSegmentClick(s.key) : undefined}
              className={cn("h-full border-r-2 border-surface last:border-r-0 motion-safe:transition-opacity", onSegmentClick && "cursor-pointer", chosen && !chosen.has(s.key) && "opacity-30")}
              style={{ width: `${share(s.value)}%`, backgroundColor: s.color }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3 lg:grid-cols-5">
        {segments.map((s) => {
          const body = (
            <>
              <span className="flex items-center gap-2 text-on-surface-muted">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="tabular-nums font-medium text-on-surface">
                {s.formattedValue} <span className="font-normal text-on-surface-muted">· {percent(s.value)}</span>
              </span>
            </>
          );
          return (
            <li key={s.key} className="flex flex-col gap-0.5">
              {onSegmentClick ? (
                <button
                  type="button"
                  aria-pressed={pressedKey === s.key}
                  onClick={() => onSegmentClick(s.key)}
                  className={cn(
                    "-mx-2 -my-1 flex flex-col gap-0.5 rounded-md border border-transparent px-2 py-1 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    pressedKey === s.key && "border-primary bg-info-bg/60",
                  )}
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
