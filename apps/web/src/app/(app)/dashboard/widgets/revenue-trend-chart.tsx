"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner, TrendBarChart, ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../../lib/api-client";

interface RevenueTrendReport {
  months: { month: string; revenue: string }[];
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short" });
}

/**
 * S-09.11 (dashboard v2) — revenue trend chart. Owner-only per
 * `GET /reports/revenue-trend`'s own gate (same as P&L/Balance Sheet) —
 * renders nothing on a 403/error, matching `DashboardSummary`'s own
 * "degrade quietly" convention. Uses `@spine/ui`'s `TrendBarChart` (added
 * alongside this widget) rather than hand-rolling axis/label/empty-state
 * handling here — see that component's own doc comment for why.
 */
export function RevenueTrendChart() {
  const [months, setMonths] = useState<3 | 6 | 12>(12);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<RevenueTrendReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setReport(null);
    apiClient
      .get<RevenueTrendReport>(`/reports/revenue-trend?months=${months}`)
      .then((res) => {
        setReport(res);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [months]);

  if (failed) {
    return null;
  }

  const chartData = (report?.months ?? []).map((m) => {
    const amount = BigInt(m.revenue);
    return {
      key: m.month,
      label: monthLabel(m.month),
      value: Number(amount) / 100,
      formattedValue: `${toDecimalString({ amount, currency })} ${currency}`,
    };
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[15px]">Revenue trend</CardTitle>
        <ToggleGroup type="single" value={String(months)} onValueChange={(v) => v && setMonths(Number(v) as 3 | 6 | 12)}>
          <ToggleGroupItem value="3">3M</ToggleGroupItem>
          <ToggleGroupItem value="6">6M</ToggleGroupItem>
          <ToggleGroupItem value="12">12M</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {!report ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <TrendBarChart data={chartData} emptyState="No revenue posted in this range yet." />
        )}
      </CardContent>
    </Card>
  );
}
