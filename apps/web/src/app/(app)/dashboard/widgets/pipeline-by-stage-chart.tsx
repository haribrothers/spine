"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, ChartContainer, ChartTooltip, ChartTooltipContent, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { apiClient } from "../../../../lib/api-client";

interface StageSummaryRow {
  stage: "new" | "qualified" | "proposal" | "won" | "lost";
  count: number;
  totalValue: string;
}

const STAGE_LABELS: Record<StageSummaryRow["stage"], string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

/**
 * S-09.11 (dashboard v2) — pipeline by stage. Bar length is deal value
 * (not lead count) by default, since "how much is in proposal" matters
 * more for forecasting than "how many" — matches the requirements draft's
 * own reasoning. Categorical palette (primary), not the financial-status
 * palette — a lead stage isn't a paid/overdue semantic.
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

  const chartData = (rows ?? []).map((r) => ({ stage: STAGE_LABELS[r.stage], value: Number(BigInt(r.totalValue)) / 100, count: r.count }));

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
          <ChartContainer config={{ value: { label: "Value", color: "var(--color-primary)" } }} className="h-40">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} width={70} />
              <ChartTooltip
                content={(props) => (
                  <ChartTooltipContent
                    {...props}
                    payload={props.payload?.map((p) => ({ ...p, value: `${toDecimalString({ amount: BigInt(Math.round(Number(p.value) * 100)), currency })} ${currency}` }))}
                  />
                )}
              />
              <Bar dataKey="value" fill="var(--color-primary)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
