"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner, ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
 * "degrade quietly" convention, since Staff/Field never see this widget
 * at all in the role-adaptive shell (Stage 3) and this component itself
 * is the last line of defense if it's ever reached anyway.
 */
export function RevenueTrendChart() {
  const [months, setMonths] = useState<3 | 6 | 12>(12);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<RevenueTrendReport | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    apiClient
      .get<RevenueTrendReport>(`/reports/revenue-trend?months=${months}`)
      .then((res) => {
        setReport(res);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [months]);

  if (failed) {
    return null;
  }

  const chartData = (report?.months ?? []).map((m) => ({ month: monthLabel(m.month), revenue: Number(BigInt(m.revenue)) / 100 }));

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
        {loading || !report ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ChartContainer config={{ revenue: { label: "Revenue", color: "var(--color-primary)" } }} className="h-40">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <ChartTooltip
                content={(props) => (
                  <ChartTooltipContent
                    {...props}
                    payload={props.payload?.map((p) => ({ ...p, value: `${toDecimalString({ amount: BigInt(Math.round(Number(p.value) * 100)), currency })} ${currency}` }))}
                  />
                )}
              />
              <Bar dataKey="revenue" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
