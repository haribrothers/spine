"use client";

import { createContext, useContext, useId } from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "../lib/cn";

/**
 * Thin theming wrapper around Recharts. Categorical series default to the
 * primary color plus muted greys; a chart displaying financial status
 * (e.g. a Revenue by status breakdown) should pass explicit paid/due-soon/
 * overdue colors from the token set instead — never mix the two palettes
 * in the same chart, per docs/DESIGN.md.
 */
export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = createContext<ChartContextValue | null>(null);

function useChartConfig() {
  const context = useContext(ChartContext);
  if (!context) throw new Error("Chart subcomponents must be used within <ChartContainer>");
  return context;
}

export function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uid = useId();
  const chartId = `chart-${uid.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-[12px] [&_.recharts-cartesian-axis-tick_text]:fill-on-surface-muted [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, value]) => value.color);
  if (entries.length === 0) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${entries
          .map(([key, value]) => `  --color-${key}: ${value.color};`)
          .join("\n")}\n}`,
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
}: Partial<RechartsPrimitive.TooltipContentProps> & {
  className?: string;
}) {
  const { config } = useChartConfig();

  if (!active || !payload?.length) return null;

  return (
    <div className={cn("rounded-md border border-border bg-surface p-2.5 shadow-raised", className)}>
      {label !== undefined && <p className="mb-1.5 text-[12px] font-medium text-on-surface">{label}</p>}
      <div className="flex flex-col gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name);
          const entryConfig = config[key];
          return (
            <div key={key} className="flex items-center gap-2 text-[12px] text-on-surface-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: entryConfig?.color ?? "var(--color-primary)" }}
              />
              <span>{entryConfig?.label ?? key}</span>
              <span className="ml-auto font-medium tabular-nums text-on-surface">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegend({ config }: { config: ChartConfig }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-[12px] text-on-surface-muted">
      {Object.entries(config).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: value.color ?? "var(--color-primary)" }} />
          <span>{value.label ?? key}</span>
        </div>
      ))}
    </div>
  );
}
