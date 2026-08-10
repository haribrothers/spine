"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { Cell, Pie, PieChart } from "recharts";
import { apiClient } from "../../../../lib/api-client";

type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

interface ReceivablesReport {
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
}

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];
const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};
/** Semantic financial-status palette — never the categorical accent, per chart.tsx's own doc-comment rule against mixing palettes. */
const BUCKET_COLORS: Record<AgingBucket, string> = {
  current: "var(--color-paid)",
  "0-30": "var(--color-due-soon)",
  "31-60": "var(--color-overdue)",
  "61-90": "var(--color-overdue)",
  "90+": "var(--color-overdue)",
};

/** S-09.11 (dashboard v2) — AR aging as a donut, reusing GET /reports/receivables' already-bucketed totals (no new backend, no client-side re-bucketing needed). */
export function ArAgingDonut() {
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
    apiClient
      .get<ReceivablesReport>("/reports/receivables")
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  const chartData = BUCKET_ORDER.map((bucket) => ({ bucket, label: BUCKET_LABELS[bucket], amount: report ? Number(BigInt(report.buckets[bucket])) / 100 : 0 })).filter((d) => d.amount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Receivables aging
          <Link href="/receivables" className="text-[13px] font-normal text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!report ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : chartData.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-on-surface-muted">Nothing outstanding.</p>
        ) : (
          <ChartContainer
            config={Object.fromEntries(BUCKET_ORDER.map((b) => [b, { label: BUCKET_LABELS[b], color: BUCKET_COLORS[b] }]))}
            className="h-40"
          >
            <PieChart>
              <ChartTooltip
                content={(props) => (
                  <ChartTooltipContent {...props} payload={props.payload?.map((p) => ({ ...p, value: `${toDecimalString({ amount: BigInt(Math.round(Number(p.value) * 100)), currency })} ${currency}` }))} />
                )}
              />
              <Pie data={chartData} dataKey="amount" nameKey="bucket" innerRadius={40} outerRadius={64} paddingAngle={2}>
                {chartData.map((d) => (
                  <Cell key={d.bucket} fill={BUCKET_COLORS[d.bucket]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
