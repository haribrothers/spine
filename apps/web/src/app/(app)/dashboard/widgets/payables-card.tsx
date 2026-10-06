"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import type { Kpi } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

/**
 * US-DASH-21 (D-160) — `DashboardOwnerBooks` › Payables: total owed to
 * vendors split current and overdue, a bar of the two, bills due in the
 * next 7 days and the most overdue bill. "Overdue" opens Payables filtered
 * to overdue. Not shown without `reports.view_payables`.
 */
export function PayablesCard() {
  const [kpi, setKpi] = useState<Kpi | null | undefined>(undefined);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
    apiClient
      .get<Kpi[]>("/dashboard/kpis")
      .then((rows) => setKpi(rows.find((k) => k.key === "payables") ?? null))
      .catch(() => setKpi(null));
  }, []);

  if (kpi === null) return null;
  const money = (minor: string | undefined) => formatMoney(BigInt(minor ?? "0"), currency);
  const current = BigInt(kpi?.detail?.current ?? "0");
  const overdue = BigInt(kpi?.detail?.overdue ?? "0");
  const total = current + overdue;
  const currentShare = total > 0n ? Number((current * 1000n) / total) / 10 : 100;

  return (
    <Card data-testid="payables-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Payables
          <Link href="/payables" className="text-[13px] font-normal text-primary hover:underline">
            Payables
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!kpi ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border">
              <div className="p-3">
                <p className="text-[12px] text-on-surface-muted">Current</p>
                <p className="text-[18px] font-semibold tabular-nums text-on-surface">{money(kpi.detail?.current)}</p>
              </div>
              <Link href="/payables?overdue=1" className="p-3 hover:bg-surface-sunken" aria-label={`Overdue ${money(kpi.detail?.overdue)} — open overdue bills`}>
                <p className="text-[12px] text-on-surface-muted">Overdue</p>
                <p className={`text-[18px] font-semibold tabular-nums ${overdue > 0n ? "text-overdue" : "text-on-surface"}`}>{money(kpi.detail?.overdue)}</p>
              </Link>
              <div className="p-3">
                <p className="text-[12px] text-on-surface-muted">Total</p>
                <p className="text-[18px] font-semibold tabular-nums text-on-surface">{money(total.toString())}</p>
              </div>
            </div>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-overdue-bg"
              role="img"
              aria-label={`Current ${money(current.toString())}, overdue ${money(overdue.toString())}`}
              data-testid="payables-bar"
            >
              <div className="h-full bg-primary" style={{ width: `${currentShare}%` }} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-[14px]">
              <span className="text-on-surface">Bills due in the next 7 days</span>
              <span className="font-medium tabular-nums text-on-surface">
                {kpi.detail?.dueSoon?.count ?? 0} · {money(kpi.detail?.dueSoon?.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-[14px]">
              <span className="text-on-surface">Oldest overdue</span>
              <span className="font-medium tabular-nums text-on-surface">
                {kpi.detail?.oldestOverdue ? `${kpi.detail.oldestOverdue.number} · ${kpi.detail.oldestOverdue.days} ${kpi.detail.oldestOverdue.days === 1 ? "day" : "days"}` : "None"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
