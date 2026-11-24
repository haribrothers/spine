"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@spine/ui";
import type { TaxPeriod } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { FigureTrio } from "./figure-trio";
import { useT } from "../../../../lib/i18n";

/**
 * US-DASH-25 (D-160) — `DashboardOwnerBooks` › Tax this period: tax
 * collected, input tax and net payable for the current month or quarter
 * (Settings › Tax › "Return period"), and what's been paid. The card opens
 * the Tax Summary for that period. Not shown without "View financial
 * statements".
 */
export function TaxPeriodCard() {
  const t = useT();
  const [data, setData] = useState<TaxPeriod | null>(null);
  const [failed, setFailed] = useState(false);
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";

  useEffect(() => {
    apiClient
      .get<TaxPeriod>("/dashboard/tax-period")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);
  const href = data ? `/reports/tax-summary?from=${data.from}&to=${data.to}` : "/reports/tax-summary";

  return (
    <Card data-testid="tax-period">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          {t("dashboard.widgets.taxPeriod")}
          <Link href={href} className="text-[13px] font-normal text-primary hover:underline">
            {t("dashboard.taxPeriod.taxSummary")}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !orgCurrency ? (
          <WidgetSkeleton kind="figures" />
        ) : (
          <Link href={href} className="flex flex-col gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("dashboard.taxPeriod.ariaLabel", { label: data.label, net: money(data.net) })}>
            <FigureTrio
              className="hover:bg-surface-sunken"
              figures={[
                { label: t("dashboard.taxPeriod.collected"), value: money(data.collected) },
                { label: t("dashboard.taxPeriod.inputTax"), value: money(data.input) },
                { label: t("dashboard.taxPeriod.netPayable"), value: money(data.net), className: "text-primary" },
              ]}
            />
            <p className="text-[13px] text-on-surface-muted" data-testid="tax-period-note">
              {data.label} · {data.paid ? t("dashboard.taxPeriod.paid", { amount: money(data.paid) }) : t("dashboard.taxPeriod.nothingPaid")}
            </p>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
