"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck, HandCoins, Target, TrendingUp, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { Card, Sparkline, cn } from "@spine/ui";
import { kpiChange, type Kpi, type KpiKey } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useDashboardBasis } from "./dashboard-basis";
import { useDashboardCurrency } from "./dashboard-currency";
import { KpiSkeleton } from "./dashboard-skeleton";
import { formatMoney } from "../../../lib/money";

/** Where each card opens (US-DASH-14). */
const KPI_HREF: Record<KpiKey, string> = {
  cash: "/reports/balance-sheet",
  profit: "/reports/profit-and-loss",
  receivables: "/receivables",
  overdue: "/receivables?overdue=1",
  pipeline: "/leads",
  quotes_won: "/quotes?status=accepted",
  payables: "/payables",
};

/**
 * US-DASH-28 (D-209) — each card's icon chip and soft tint. Category
 * colours, so the status colours keep their meaning; Overdue is a status,
 * so it keeps the reserved red.
 */
const KPI_LOOK: Record<KpiKey, { icon: LucideIcon; card: string; chip: string }> = {
  cash: { icon: Wallet, card: "border-category-blue/15 bg-category-blue-bg/70", chip: "bg-category-blue" },
  profit: { icon: TrendingUp, card: "border-category-teal/15 bg-category-teal-bg/70", chip: "bg-category-teal" },
  receivables: { icon: HandCoins, card: "border-category-purple/15 bg-category-purple-bg/70", chip: "bg-category-purple" },
  overdue: { icon: TriangleAlert, card: "border-overdue/15 bg-overdue-bg/70", chip: "bg-overdue" },
  pipeline: { icon: Target, card: "border-category-amber/15 bg-category-amber-bg/70", chip: "bg-category-amber" },
  quotes_won: { icon: FileCheck, card: "border-category-green/15 bg-category-green-bg/70", chip: "bg-category-green" },
  payables: { icon: Wallet, card: "border-category-slate/15 bg-category-slate-bg/70", chip: "bg-category-slate" },
};

/** A long figure steps down a size so the whole amount stays on one line (US-DASH-28). */
function figureSize(text: string): string {
  return text.length > 14 ? "text-[16px] @[13rem]:text-[18px] @[16rem]:text-[21px]" : "text-[18px] @[13rem]:text-[21px] @[16rem]:text-[24px]";
}

/**
 * US-DASH-14 (D-089) — the pinned row of key figures. Each card shows the
 * amount, a line of the last 8 weeks and "▲/▼ n% vs last month", green when
 * the change is good for the business and red when it isn't (the arrow and
 * sign say it too). Cards are the ones the server says this member may
 * see; a member with none sees no row. US-DASH-27/28: four grey cards
 * until the figures arrive; then an icon chip, a tint and the figure on
 * its own line with the trend under it.
 */
export function KpiRow() {
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const currency = useDashboardCurrency();
  const { basis, ready } = useDashboardBasis();

  useEffect(() => {
    if (!ready) return;
    apiClient
      .get<Kpi[]>(`/dashboard/kpis?basis=${basis}`)
      // US-DASH-21 — payables has its own card, not a place in this row.
      .then((rows) => setKpis(rows.filter((k) => k.key !== "payables")))
      .catch(() => setKpis([]));
  }, [basis, ready]);

  // US-OPS-14: two per row on a phone.
  const grid = "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 wide-plus:grid-cols-2 wide-plus:@[62rem]:grid-cols-4";

  if (!kpis || !currency) {
    return (
      <div className={grid} data-testid="kpi-row-loading">
        {[0, 1, 2, 3].map((i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (kpis.length === 0) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);

  return (
    <div className={grid} data-testid="kpi-row">
      {kpis.map((kpi) => {
        const change = kpiChange(kpi);
        const noData =
          kpi.previous === null &&
          BigInt(kpi.value) === 0n &&
          kpi.series.every((v) => v === "0");
        const value = kpi.format === "money" ? money(kpi.value) : kpi.value;
        const look = KPI_LOOK[kpi.key];
        const Icon = look.icon;
        return (
          <Link
            key={kpi.key}
            href={KPI_HREF[kpi.key]}
            className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`${kpi.label}: ${value}. ${noData ? "No data yet" : change.text}`}
          >
            <Card
              className={cn("@container flex h-full flex-col gap-1.5 p-4 transition-colors group-hover:border-border-strong", look.card)}
              data-kpi={kpi.key}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-on-surface">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-surface", look.chip)} data-testid="kpi-chip">
                  <Icon size={15} aria-hidden />
                </span>
                {kpi.label}
              </span>
              <span className={cn("mt-1 whitespace-nowrap font-semibold tabular-nums leading-tight text-on-surface", figureSize(value))} data-testid="kpi-figure">
                {value}
              </span>
              {!noData && (
                <Sparkline
                  className="h-7 w-full"
                  values={kpi.series.map(Number)}
                  tone={
                    change.tone === "good"
                      ? "positive"
                      : change.tone === "bad"
                        ? "negative"
                        : "neutral"
                  }
                />
              )}
              <span
                className={cn(
                  "text-[12px]",
                  change.tone === "good" && "text-paid",
                  change.tone === "bad" && "text-overdue",
                  change.tone === "none" && "text-on-surface-muted",
                )}
              >
                {/* US-DASH-26 — says which basis profit is on when it's cash. */}
                {kpi.key === "profit" && kpi.basis === "cash" && (
                  <span className="text-on-surface-muted">cash basis · </span>
                )}
                {noData ? "No data yet" : change.text}
              </span>
              {kpi.key === "receivables" && kpi.detail && !noData && (
                <span className="text-[12px] text-on-surface-muted">
                  Current {money(kpi.detail.current ?? "0")} · overdue{" "}
                  {money(kpi.detail.overdue ?? "0")}
                </span>
              )}
              {kpi.key === "quotes_won" &&
                kpi.detail?.amount !== undefined &&
                BigInt(kpi.detail.amount) > 0n && (
                  <span className="text-[12px] text-on-surface-muted">
                    {money(kpi.detail.amount)} accepted
                  </span>
                )}
              {kpi.key === "overdue" &&
                kpi.detail?.count !== undefined &&
                kpi.detail.count > 0 && (
                  <span className="text-[12px] text-on-surface-muted">
                    {kpi.detail.count}{" "}
                    {kpi.detail.count === 1 ? "invoice" : "invoices"}
                  </span>
                )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
