"use client";

import { Card, Skeleton, cn } from "@spine/ui";

/** Placeholders never shimmer with Reduce Motion on. */
function Block({ className }: { className?: string }) {
  return <Skeleton aria-hidden className={cn("rounded-sm motion-reduce:animate-none", className)} />;
}

export type WidgetSkeletonKind = "rows" | "bars" | "ring" | "figures" | "figure" | "chart" | "line";

const CHART_HEIGHTS = ["h-[30%]", "h-[45%]", "h-[25%]", "h-[60%]", "h-[40%]", "h-[70%]", "h-[50%]", "h-[85%]", "h-[55%]", "h-[65%]", "h-[35%]", "h-[75%]"];

/**
 * US-DASH-27 (D-209) — the grey outline of a card's own content while its
 * data is on its way: rows, bars, a ring, figures or a chart. Hidden from
 * screen readers; the dashboard says "Loading dashboard" once instead.
 */
export function WidgetSkeleton({ kind, rows = 3 }: { kind: WidgetSkeletonKind; rows?: number }) {
  return (
    <div aria-hidden data-testid="widget-skeleton" className="flex flex-col gap-3">
      {kind === "rows" &&
        Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Block className="size-8 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Block className="h-2.5 w-3/4" />
              <Block className="h-2.5 w-2/5" />
            </div>
            <Block className="h-2.5 w-16 shrink-0" />
          </div>
        ))}
      {kind === "bars" &&
        Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <Block className="h-2.5 w-2/5" />
              <Block className="h-2.5 w-1/4" />
            </div>
            <Block className="h-1.5 w-full" />
          </div>
        ))}
      {kind === "ring" && (
        <div className="flex flex-wrap items-center justify-center gap-5">
          <Block className="size-32 shrink-0 rounded-full" />
          <div className="flex min-w-32 flex-1 flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Block key={i} className="h-2.5 w-full" />
            ))}
          </div>
        </div>
      )}
      {kind === "figures" && (
        <>
          <Block className="h-24 w-full rounded-md" />
          <Block className="h-2.5 w-4/5" />
          <Block className="h-2.5 w-3/5" />
        </>
      )}
      {kind === "figure" && (
        <>
          <Block className="h-6 w-1/2" />
          <Block className="h-2.5 w-3/4" />
          {Array.from({ length: rows }, (_, i) => (
            <Block key={i} className="h-2.5 w-full" />
          ))}
        </>
      )}
      {kind === "chart" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Block className="h-2.5 w-3/5" />
                <Block className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className="flex h-40 items-end gap-2">
            {CHART_HEIGHTS.map((h, i) => (
              <Block key={i} className={cn("flex-1", h)} />
            ))}
          </div>
        </>
      )}
      {kind === "line" && <Block className="h-2.5 w-3/5" />}
    </div>
  );
}

/** A KPI card while its figure is on its way. */
export function KpiSkeleton() {
  return (
    <Card aria-hidden data-testid="kpi-skeleton" className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <Block className="size-7 rounded-md" />
        <Block className="h-2.5 w-1/2" />
      </div>
      <Block className="h-6 w-3/4" />
      <Block className="h-6 w-full" />
      <Block className="h-2.5 w-3/5" />
    </Card>
  );
}

/** A whole card in grey: its title bar and the outline of its content. */
function CardSkeleton({ kind, rows, className }: { kind: WidgetSkeletonKind; rows?: number; className?: string }) {
  return (
    <Card aria-hidden className={cn("mb-4 break-inside-avoid", className)}>
      <div className="mb-4 flex justify-between gap-3">
        <Block className="h-3.5 w-2/5" />
        <Block className="h-3 w-16" />
      </div>
      <WidgetSkeleton kind={kind} rows={rows} />
    </Card>
  );
}

const OWNER_CARDS: { kind: WidgetSkeletonKind; rows?: number }[] = [
  { kind: "rows", rows: 2 },
  { kind: "figures" },
  { kind: "line" },
  { kind: "figures" },
  { kind: "bars", rows: 4 },
  { kind: "bars", rows: 5 },
  { kind: "ring" },
  { kind: "bars", rows: 3 },
];
const FIELD_CARDS: { kind: WidgetSkeletonKind; rows?: number }[] = [
  { kind: "rows", rows: 3 },
  { kind: "rows", rows: 4 },
];

/**
 * US-DASH-27 — the page's shape until the member's layout, rights and
 * modules are known: "Needs your attention" and "Today", four KPI cards
 * (when the member sees them) and cards in the role's default layout. It
 * uses the same frame as the dashboard, so nothing moves when the real
 * cards arrive.
 */
export function DashboardSkeleton({ field, side }: { field: boolean; side: (cards: React.ReactNode) => React.ReactNode }) {
  const cards = field ? FIELD_CARDS : OWNER_CARDS;
  return (
    <>
      {side(
        <>
          <CardSkeleton kind="rows" rows={3} className="mb-0 xl:col-span-2 wide-plus:col-span-1" />
          <CardSkeleton kind="rows" rows={2} className="mb-0" />
        </>,
      )}
      <div className="flex min-w-0 flex-col gap-4 wide-plus:col-start-1 wide-plus:row-start-1">
        {!field && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 wide-plus:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        )}
        {!field && <CardSkeleton kind="chart" className="mb-0" />}
        <div className={cn("columns-1 gap-4", field ? "lg:columns-2" : "lg:columns-2 xl:columns-3 wide-plus:columns-2")}>
          {cards.map((c, i) => (
            <CardSkeleton key={i} kind={c.kind} rows={c.rows} />
          ))}
        </div>
      </div>
    </>
  );
}
