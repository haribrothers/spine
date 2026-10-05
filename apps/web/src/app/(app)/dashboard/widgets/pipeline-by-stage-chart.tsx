"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner, TrendBarChart } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

/** One row per pipeline stage, in board order (US-CRM-19: the organisation's own stages). */
interface StageSummaryRow {
  stageId: string;
  name: string;
  kind: "open" | "won" | "lost";
  count: number;
  totalValue: string;
}

/**
 * S-09.11 (dashboard v2) — pipeline by stage. Bar length is deal value
 * (not lead count) by default, since "how much is in proposal" matters
 * more for forecasting than "how many" — matches the requirements draft's
 * own reasoning. Uses `@spine/ui`'s `TrendBarChart` in horizontal
 * orientation, same component the revenue trend widget uses.
 */
export function PipelineByStageChart() {
  const [currency, setCurrency] = useState("USD");
  const [rows, setRows] = useState<StageSummaryRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
    apiClient
      .get<StageSummaryRow[]>("/leads/summary-by-stage")
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  const chartData = (rows ?? []).map((r) => {
    const amount = r.totalValue === "0" ? 0n : BigInt(r.totalValue);
    return {
      key: r.stageId,
      label: r.name,
      value: Number(amount) / 100,
      formattedValue: `${formatMoney(amount, currency)} · ${r.count}`,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Pipeline by stage
          <Link href="/leads" className="text-[13px] font-normal text-primary hover:underline">
            View board
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <TrendBarChart data={chartData} orientation="horizontal" emptyState="No leads yet." />
        )}
      </CardContent>
    </Card>
  );
}
