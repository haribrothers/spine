"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import type { TaxPeriod } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

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
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
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
        {!data ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Link href={href} className="flex flex-col gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Tax for ${data.label}: net payable ${money(data.net)}. Open the Tax Summary.`}>
            <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border hover:bg-surface-sunken">
              <div className="p-3">
                <p className="text-[12px] text-on-surface-muted">Collected</p>
                <p className="text-[18px] font-semibold tabular-nums text-on-surface">{money(data.collected)}</p>
              </div>
              <div className="p-3">
                <p className="text-[12px] text-on-surface-muted">Input tax</p>
                <p className="text-[18px] font-semibold tabular-nums text-on-surface">{money(data.input)}</p>
              </div>
              <div className="p-3">
                <p className="text-[12px] text-on-surface-muted">Net payable</p>
                <p className="text-[18px] font-semibold tabular-nums text-primary">{money(data.net)}</p>
              </div>
            </div>
            <p className="text-[13px] text-on-surface-muted" data-testid="tax-period-note">
              {data.label} · {data.paid ? `paid ${money(data.paid)}` : "nothing paid yet"}
            </p>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
