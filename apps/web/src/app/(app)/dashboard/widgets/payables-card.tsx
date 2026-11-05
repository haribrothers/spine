"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@spine/ui";
import type { Kpi } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { FigureTrio } from "./figure-trio";
import { useT } from "../../../../lib/i18n";

/**
 * US-DASH-21 (D-160) — `DashboardOwnerBooks` › Payables: total owed to
 * vendors split current and overdue, a bar of the two, bills due in the
 * next 7 days and the most overdue bill. "Overdue" opens Payables filtered
 * to overdue. Not shown without `reports.view_payables`.
 */
export function PayablesCard() {
  const t = useT();
  const [kpi, setKpi] = useState<Kpi | null | undefined>(undefined);
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";

  useEffect(() => {
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
          {t("dashboard.widgets.payables")}
          <Link href="/payables" className="text-[13px] font-normal text-primary hover:underline">
            {t("dashboard.widgets.payables")}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!kpi || !orgCurrency ? (
          <WidgetSkeleton kind="figures" />
        ) : (
          <div className="flex flex-col gap-4">
            <FigureTrio
              figures={[
                { label: t("dashboard.payables.current"), value: money(kpi.detail?.current) },
                {
                  label: t("dashboard.payables.overdue"),
                  value: money(kpi.detail?.overdue),
                  className: overdue > 0n ? "text-overdue" : undefined,
                  href: "/payables?overdue=1",
                  "aria-label": t("dashboard.payables.overdueAria", { amount: money(kpi.detail?.overdue) }),
                },
                { label: t("dashboard.payables.total"), value: money(total.toString()) },
              ]}
            />
            <div
              className="flex h-2 overflow-hidden rounded-full bg-overdue-bg"
              role="img"
              aria-label={t("dashboard.payables.barAria", { current: money(current.toString()), overdue: money(overdue.toString()) })}
              data-testid="payables-bar"
            >
              <div className="h-full bg-primary" style={{ width: `${currentShare}%` }} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-[14px]">
              <span className="text-on-surface">{t("dashboard.payables.dueSoon")}</span>
              <span className="whitespace-nowrap font-medium tabular-nums text-on-surface">
                {kpi.detail?.dueSoon?.count ?? 0} · {money(kpi.detail?.dueSoon?.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-[14px]">
              <span className="text-on-surface">{t("dashboard.payables.oldestOverdue")}</span>
              <span className="whitespace-nowrap font-medium tabular-nums text-on-surface">
                {kpi.detail?.oldestOverdue ? t("dashboard.payables.oldestDays", { number: kpi.detail.oldestOverdue.number, count: kpi.detail.oldestOverdue.days }) : t("dashboard.payables.none")}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
