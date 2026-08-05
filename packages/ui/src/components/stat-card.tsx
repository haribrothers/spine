import { cn } from "../lib/cn";
import { Card } from "./card";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
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
export function StatCard({ label, value, trend, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-1", className)} {...props}>
      <span className="text-[13px] font-semibold text-on-surface-muted">{label}</span>
      <span className="text-[32px] font-bold leading-tight tracking-tight text-on-surface">
        {value}
      </span>
      {trend && (
        <span className={cn("text-[13px] font-medium", trendColor[trend.direction])}>
          {trend.label}
        </span>
      )}
    </Card>
  );
}
