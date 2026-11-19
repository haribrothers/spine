"use client";

import * as RechartsPrimitive from "recharts";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";
import { ChartContainer, ChartTooltip, type ChartConfig } from "./chart";

export interface GroupedBarChartSeries {
  key: string;
  label: string;
  /** A theme token, e.g. `var(--color-primary)`. */
  color: string;
}

export interface GroupedBarChartMarker {
  /** The data field holding the marker's value (e.g. a cost budget). Rows without it show no marker. */
  key: string;
  label: string;
  /** The series whose bar the dashed marker sits over. */
  seriesKey: string;
}

export type GroupedBarChartRow = { key: string; label: string } & Record<string, string | number | null>;

export interface GroupedBarChartProps {
  data: GroupedBarChartRow[];
  series: GroupedBarChartSeries[];
  /** An optional dashed line across one series' bar, e.g. a budget over cost. */
  marker?: GroupedBarChartMarker;
  /** Axis ticks, e.g. "$30k". */
  formatTick: (value: number) => string;
  /** The tooltip's body for a group; text, so it reads in both themes. */
  renderTooltip: (row: GroupedBarChartRow) => React.ReactNode;
  /** Names the chart for screen readers. */
  "aria-label": string;
  /** Points screen-reader users to the same figures in text, e.g. "The table below lists every job." */
  description?: string;
  emptyState?: React.ReactNode;
  className?: string;
}

/**
 * Several series side by side for each category — e.g. a job's contract
 * value, billed to date and cost — with a text legend, axis ticks and an
 * optional dashed marker over one series (a budget over cost). A chart is
 * never the only place figures live: pass `description` pointing at the
 * table that lists them.
 */
export function GroupedBarChart({ data, series, marker, formatTick, renderTooltip, "aria-label": ariaLabel, description, emptyState, className }: GroupedBarChartProps) {
  const t = useT();
  // US-RPT-41: on a phone the chart is the screen's width, its legend under it and only some months labelled.
  const phone = usePhone();
  const values = data.flatMap((row) => [...series.map((s) => Number(row[s.key] ?? 0)), marker ? Number(row[marker.key] ?? 0) : 0]);
  const max = Math.max(0, ...values);

  if (data.length === 0 || max === 0) {
    return <div className={cn("flex h-48 items-center justify-center text-[13px] text-on-surface-muted", className)}>{emptyState ?? t("ui.chart.noData")}</div>;
  }

  // Four even steps of a round size, so the ticks read cleanly.
  const rawStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((n) => n * magnitude >= rawStep) ?? 10) * magnitude;
  const top = step * 4;
  const ticks = [0, step, step * 2, step * 3, top];
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className={cn("flex flex-wrap items-center gap-4 text-[12px] text-on-surface-muted", phone ? "order-last justify-center" : "justify-end")}>
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
        {marker && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-on-surface" aria-hidden />
            {marker.label}
          </span>
        )}
      </div>
      <ChartContainer config={config} className="aspect-auto h-64 w-full" role="img" aria-label={ariaLabel}>
        <RechartsPrimitive.BarChart data={data} margin={phone ? { top: 8, right: 4, left: 0 } : { top: 8, right: 8, left: 8 }} barGap={phone ? 2 : 4}>
          <RechartsPrimitive.CartesianGrid vertical={false} />
          <RechartsPrimitive.XAxis dataKey="label" tickLine={false} axisLine={false} interval={phone ? "preserveStartEnd" : 0} minTickGap={phone ? 12 : undefined} />
          <RechartsPrimitive.YAxis domain={[0, top]} ticks={ticks} tickFormatter={formatTick} tickLine={false} axisLine={false} width={phone ? 44 : 56} />
          <ChartTooltip
            cursor={{ fill: "var(--color-surface-sunken)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as GroupedBarChartRow | undefined;
              if (!active || !row) return null;
              return <div className="rounded-md border border-border bg-surface p-2.5 text-[12px] text-on-surface shadow-raised">{renderTooltip(row)}</div>;
            }}
          />
          {series.map((s) => (
            <RechartsPrimitive.Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              {...(marker?.seriesKey === s.key
                ? {
                    // eslint-disable-next-line i18next/no-literal-string -- a colour, not copy
                    background: { fill: "transparent" },
                    shape: (props: unknown) => <BarWithMarker {...(props as BarShapeProps)} markerKey={marker.key} top={top} />,
                  }
                : {})}
            />
          ))}
        </RechartsPrimitive.BarChart>
      </ChartContainer>
      {description && <figcaption className="sr-only">{description}</figcaption>}
    </figure>
  );
}

interface BarShapeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  payload: GroupedBarChartRow;
  background?: { x: number; y: number; width: number; height: number };
}

/** The series' bar plus a dashed line at the marker's value, measured against the plot's full height. */
function BarWithMarker({ x, y, width, height, fill, payload, background, markerKey, top }: BarShapeProps & { markerKey: string; top: number }) {
  const value = Number(payload[markerKey] ?? 0);
  const markerY = background && value > 0 ? background.y + background.height * (1 - value / top) : null;
  return (
    <g>
      {height > 0 && <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />}
      {markerY !== null && <line x1={x - 4} x2={x + width + 4} y1={markerY} y2={markerY} stroke="var(--color-on-surface)" strokeWidth={2} strokeDasharray="4 3" />}
    </g>
  );
}
