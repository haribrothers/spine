"use client";

import * as RechartsPrimitive from "recharts";
import { cn } from "../lib/cn";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";

export interface TrendBarChartPoint {
  key: string;
  label: string;
  value: number;
  /** Pre-formatted for the tooltip and the on-bar label (e.g. "$1,234.00 USD") — this component never assumes a currency or unit. */
  formattedValue: string;
}

export interface TrendBarChartProps {
  data: TrendBarChartPoint[];
  /** "vertical" (bars grow up, category axis along the bottom — a time trend) or "horizontal" (bars grow right, category axis on the left — a ranked/categorical breakdown). */
  orientation?: "vertical" | "horizontal";
  color?: string;
  /** Shown when every point's `value` is 0 (or `data` is empty). */
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * A single-series bar chart with real value labels and a real empty
 * state — the two things a bare Recharts `BarChart` inside
 * `ChartContainer` doesn't give you for free, and both matter more than
 * usual on a dashboard widget sized for a small card rather than a full
 * report page (a 12-bar chart with 11 empty months and no labels reads as
 * broken, not "quiet"). Extracted from the dashboard's revenue trend and
 * pipeline-by-stage widgets (S-09.11) — any future trend/ranked-breakdown
 * chart should reuse this rather than re-solving axis/label/empty-state
 * handling per widget.
 *
 * Deliberately single-series — a chart comparing multiple series (e.g.
 * revenue vs. cost) needs its own legend/color-per-series design that a
 * "just add a second bar" extension here would get wrong; build that as
 * its own component when a real second use case exists, per this
 * codebase's own no-speculative-abstraction convention.
 */
export function TrendBarChart({ data, orientation = "vertical", color = "var(--color-primary)", emptyState, className }: TrendBarChartProps) {
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className={cn("flex h-40 items-center justify-center text-[13px] text-on-surface-muted", className)}>
        {emptyState ?? "No data yet."}
      </div>
    );
  }

  const config: ChartConfig = { value: { label: "Value", color } };
  const tooltipContent = (props: Parameters<typeof ChartTooltipContent>[0]) => (
    <ChartTooltipContent {...props} payload={props.payload?.map((p) => ({ ...p, value: data.find((d) => d.key === p.payload?.key)?.formattedValue ?? p.value }))} />
  );

  if (orientation === "horizontal") {
    return (
      <ChartContainer config={config} className={cn("h-40", className)}>
        <RechartsPrimitive.BarChart data={data} layout="vertical" margin={{ left: 4, right: 104 }}>
          <RechartsPrimitive.CartesianGrid horizontal={false} />
          <RechartsPrimitive.XAxis type="number" hide />
          <RechartsPrimitive.YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={76} />
          <ChartTooltip content={tooltipContent} />
          <RechartsPrimitive.Bar dataKey="value" fill={color} radius={4}>
            <RechartsPrimitive.LabelList
              dataKey="formattedValue"
              position="right"
              content={(props: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; index?: number }) => {
                const point = props.index !== undefined ? data[props.index] : undefined;
                if (!point || props.x === undefined || props.y === undefined || props.height === undefined) return null;
                // After the bar's end, never over it.
                const x = Number(props.x) + Number(props.width ?? 0);
                const y = Number(props.y);
                const height = Number(props.height);
                return (
                  <text x={x + 6} y={y + height / 2} dominantBaseline="middle" className="fill-on-surface-muted text-[11px]">
                    {point.value === 0 ? "—" : point.formattedValue}
                  </text>
                );
              }}
            />
          </RechartsPrimitive.Bar>
        </RechartsPrimitive.BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className={cn("h-40", className)}>
      <RechartsPrimitive.BarChart data={data} margin={{ top: 20 }}>
        <RechartsPrimitive.CartesianGrid vertical={false} />
        <RechartsPrimitive.XAxis dataKey="label" tickLine={false} axisLine={false} />
        <ChartTooltip content={tooltipContent} />
        <RechartsPrimitive.Bar dataKey="value" fill={color} radius={4}>
          <RechartsPrimitive.LabelList
            dataKey="formattedValue"
            position="top"
            className="fill-on-surface-muted text-[11px]"
            content={(props: { x?: string | number; y?: string | number; width?: string | number; index?: number }) => {
              const point = props.index !== undefined ? data[props.index] : undefined;
              if (!point || point.value === 0 || props.x === undefined || props.y === undefined || props.width === undefined) return null;
              const x = Number(props.x);
              const y = Number(props.y);
              const width = Number(props.width);
              return (
                <text x={x + width / 2} y={y - 6} textAnchor="middle" className="fill-on-surface-muted text-[11px]">
                  {point.formattedValue}
                </text>
              );
            }}
          />
        </RechartsPrimitive.Bar>
      </RechartsPrimitive.BarChart>
    </ChartContainer>
  );
}
