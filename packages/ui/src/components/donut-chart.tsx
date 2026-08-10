"use client";

import * as RechartsPrimitive from "recharts";
import { cn } from "../lib/cn";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";

export interface DonutChartSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Pre-formatted for display in the legend/tooltip (e.g. "$1,234.00 USD") — this component never assumes a currency or unit. */
  formattedValue: string;
}

export interface DonutChartProps {
  segments: DonutChartSegment[];
  /** Rendered in the donut's empty center — typically a total. Omit for no center label. */
  centerLabel?: React.ReactNode;
  /** Shown when every segment's `value` is 0 (or `segments` is empty) — a donut with no data reads as broken, not "nothing here," without one. */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * A labeled donut chart: a Recharts `Pie` inside `ChartContainer`, plus the
 * two things a color-only donut is missing without them — a legend (each
 * segment's label + formatted value, not just a color swatch) and an
 * optional center total. Extracted from the dashboard's AR aging widget
 * (S-09.11) since any future report wanting a proportional breakdown
 * (e.g. tax collected by rate, expense by category) would otherwise
 * re-solve the same "which color is which, what does the ring actually
 * add up to" problem from scratch.
 *
 * Callers own their own segment colors (this component doesn't guess a
 * palette) — per `chart.tsx`'s own rule, pass the semantic paid/due-soon/
 * overdue tokens for a financial-status breakdown, the categorical accent
 * for anything else.
 */
export function DonutChart({ segments, centerLabel, emptyState, className }: DonutChartProps) {
  const visible = segments.filter((s) => s.value > 0);

  if (visible.length === 0) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-[13px] text-on-surface-muted", className)}>
        {emptyState ?? "No data."}
      </div>
    );
  }

  const config: ChartConfig = Object.fromEntries(segments.map((s) => [s.key, { label: s.label, color: s.color }]));

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <ChartContainer config={config} className="h-40 w-40 shrink-0 aspect-square">
        <RechartsPrimitive.PieChart>
          <ChartTooltip content={(props) => <ChartTooltipContent {...props} payload={props.payload?.map((p) => ({ ...p, value: segments.find((s) => s.key === p.dataKey || s.key === p.name)?.formattedValue ?? p.value }))} />} />
          <RechartsPrimitive.Pie data={visible} dataKey="value" nameKey="key" innerRadius="60%" outerRadius="90%" paddingAngle={2}>
            {visible.map((s) => (
              <RechartsPrimitive.Cell key={s.key} fill={s.color} />
            ))}
            {centerLabel !== undefined && (
              <RechartsPrimitive.Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || viewBox.cx === undefined || viewBox.cy === undefined) return null;
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-on-surface text-[13px] font-semibold">
                      {String(centerLabel)}
                    </text>
                  );
                }}
              />
            )}
          </RechartsPrimitive.Pie>
        </RechartsPrimitive.PieChart>
      </ChartContainer>
      <div className="flex flex-1 flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2 text-on-surface-muted">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span>{s.label}</span>
            </div>
            <span className="font-mono tabular-nums text-on-surface">{s.value === 0 ? "—" : s.formattedValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
