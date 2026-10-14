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

/**
 * US-DASH-25 (D-160) — `DashboardOwnerBooks` › Tax this period: tax
 * collected, input tax and net payable for the current month or quarter
 * (Settings › Tax › "Return period"), and what's been paid. The card opens
 * the Tax Summary for that period. Not shown without "View financial
 * statements".
 */
export function TaxPeriodCard() {
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
          Tax this period
          <Link href={href} className="text-[13px] font-normal text-primary hover:underline">
            Tax Summary
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !orgCurrency ? (
          <WidgetSkeleton kind="figures" />
        ) : (
          <Link href={href} className="flex flex-col gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Tax for ${data.label}: net payable ${money(data.net)}. Open the Tax Summary.`}>
            <FigureTrio
              className="hover:bg-surface-sunken"
              figures={[
                { label: "Collected", value: money(data.collected) },
                { label: "Input tax", value: money(data.input) },
                { label: "Net payable", value: money(data.net), className: "text-primary" },
              ]}
            />
            <p className="text-[13px] text-on-surface-muted" data-testid="tax-period-note">
              {data.label} · {data.paid ? `paid ${money(data.paid)}` : "nothing paid yet"}
            </p>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
