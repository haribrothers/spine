import { cn } from "../lib/cn";

const TONES = {
  positive: "stroke-paid",
  negative: "stroke-overdue",
  neutral: "stroke-on-surface-muted",
} as const;

export interface SparklineProps {
  /** Oldest first. */
  values: number[];
  /** Green when the trend is good for the business, red when it isn't. Never the only signal: show the change in text beside it. */
  tone?: keyof typeof TONES;
  className?: string;
}

/**
 * A small trend line beside a key figure — e.g. the last 8 weeks of cash.
 * Decorative: the figure and its change are always written next to it, so
 * it's hidden from screen readers.
 */
export function Sparkline({ values, tone = "neutral", className }: SparklineProps) {
  const width = 100;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points =
    values.length > 1
      ? values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(2)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(2)}`).join(" ")
      : `0,${height / 2} ${width},${height / 2}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("h-8 w-24", className)} aria-hidden="true" focusable="false">
      <polyline points={points} fill="none" className={TONES[tone]} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
