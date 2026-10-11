import { cn } from "../lib/cn";
import { Card } from "./card";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  /** US-QUO-27 — a smaller figure beside the value, e.g. the amount behind a count ("₹16,82,330"). */
  detail?: string;
  /** US-QUO-27 — "warning" colours the value due-soon; US-INV-27 — "critical" colours it overdue (the label says why, never colour alone). */
  tone?: "default" | "warning" | "critical";
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
}

const trendColor = {
  up: "text-paid",
  down: "text-overdue",
  neutral: "text-on-surface-muted",
} as const;

/** A Card variant for a single dashboard KPI (cash position, receivables, overdue count), per §F0. */
export function StatCard({ label, value, detail, tone = "default", trend, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)} {...props}>
      <span className="text-[13px] font-semibold text-on-surface-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("text-[32px] font-bold leading-tight tracking-tight", tone === "warning" ? "text-due-soon" : tone === "critical" ? "text-overdue" : "text-on-surface")}>{value}</span>
        {detail && <span className="text-[13px] font-medium tabular-nums text-on-surface-muted">{detail}</span>}
      </span>
      {trend && (
        <span className={cn("text-[13px] font-medium", trendColor[trend.direction])}>
          {trend.label}
        </span>
      )}
    </Card>
  );
}
