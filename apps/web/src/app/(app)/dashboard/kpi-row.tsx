"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Sparkline, cn } from "@spine/ui";
import { kpiChange, type Kpi, type KpiKey } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";

/** Where each card opens (US-DASH-14). */
const KPI_HREF: Record<KpiKey, string> = {
  cash: "/reports/balance-sheet",
  profit: "/reports/profit-and-loss",
  receivables: "/receivables",
  overdue: "/receivables?overdue=1",
  pipeline: "/leads",
  quotes_won: "/quotes?status=accepted",
};

/**
 * US-DASH-14 (D-089) — the pinned row of key figures. Each card shows the
 * amount, a line of the last 8 weeks and "▲/▼ n% vs last month", green when
 * the change is good for the business and red when it isn't (the arrow and
 * sign say it too). Cards are the ones the server says this member may
 * see; a member with none sees no row.
 */
export function KpiRow() {
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
    apiClient
      .get<Kpi[]>("/dashboard/kpis")
      .then(setKpis)
      .catch(() => setKpis([]));
  }, []);

  if (!kpis || kpis.length === 0) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="kpi-row">
      {kpis.map((kpi) => {
        const change = kpiChange(kpi);
        const noData = kpi.previous === null && BigInt(kpi.value) === 0n && kpi.series.every((v) => v === "0");
        const value = kpi.format === "money" ? money(kpi.value) : kpi.value;
        return (
          <Link key={kpi.key} href={KPI_HREF[kpi.key]} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`${kpi.label}: ${value}. ${noData ? "No data yet" : change.text}`}>
            <Card className="flex h-full flex-col gap-1 transition-colors group-hover:border-border-strong" data-kpi={kpi.key}>
              <span className="text-[13px] text-on-surface-muted">{kpi.label}</span>
              <div className="flex items-end justify-between gap-3">
                <span className="text-[26px] font-semibold tabular-nums leading-tight text-on-surface">{value}</span>
                {!noData && <Sparkline values={kpi.series.map(Number)} tone={change.tone === "good" ? "positive" : change.tone === "bad" ? "negative" : "neutral"} />}
              </div>
              <span className={cn("text-[12px]", change.tone === "good" && "text-paid", change.tone === "bad" && "text-overdue", change.tone === "none" && "text-on-surface-muted")}>
                {noData ? "No data yet" : change.text}
              </span>
              {kpi.key === "receivables" && kpi.detail && !noData && (
                <span className="text-[12px] text-on-surface-muted">
                  Current {money(kpi.detail.current ?? "0")} · overdue {money(kpi.detail.overdue ?? "0")}
                </span>
              )}
              {kpi.key === "quotes_won" && kpi.detail?.amount !== undefined && BigInt(kpi.detail.amount) > 0n && (
                <span className="text-[12px] text-on-surface-muted">{money(kpi.detail.amount)} accepted</span>
              )}
              {kpi.key === "overdue" && kpi.detail?.count !== undefined && kpi.detail.count > 0 && (
                <span className="text-[12px] text-on-surface-muted">
                  {kpi.detail.count} {kpi.detail.count === 1 ? "invoice" : "invoices"}
                </span>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
