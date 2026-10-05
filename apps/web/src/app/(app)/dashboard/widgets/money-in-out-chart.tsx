"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, GroupedBarChart, Spinner, ToggleGroup, ToggleGroupItem, cn } from "@spine/ui";
import type { MoneyInOutReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { minorUnitExponent } from "@spine/shared/money";
import { formatMoney } from "../../../../lib/money";

type Range = 3 | 6 | 12;

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function monthName(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * US-DASH-15 — money received and money spent per month, side by side,
 * with the range's totals and net above the chart. Figures come from the
 * cash and bank accounts' journal lines (`GET /reports/money-in-out`), so
 * the chart and the books never disagree. Renders nothing on a 403, like
 * every gated widget.
 */
export function MoneyInOutChart() {
  const [months, setMonths] = useState<Range>(12);
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<MoneyInOutReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setReport(null);
    apiClient
      .get<MoneyInOutReport>(`/reports/money-in-out?months=${months}`)
      .then((res) => {
        setReport(res);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [months]);

  if (failed) return null;

  const scale = 10 ** minorUnitExponent(currency);
  const compact = new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 });
  const money = (minor: string | bigint) => formatMoney(BigInt(minor), currency);
  const rangeLabel = `${months} months`;
  const net = report ? BigInt(report.net) : 0n;
  const rows = (report?.months ?? []).map((m) => ({ key: m.month, label: monthLabel(m.month), in: Number(m.in), out: Number(m.out), inMinor: m.in, outMinor: m.out }));

  return (
    <Card data-testid="money-in-out">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-[15px]">Money in and out</CardTitle>
        <ToggleGroup type="single" value={String(months)} onValueChange={(v) => v && setMonths(Number(v) as Range)} aria-label="Range">
          <ToggleGroupItem value="3">3M</ToggleGroupItem>
          <ToggleGroupItem value="6">6M</ToggleGroupItem>
          <ToggleGroupItem value="12">12M</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!report ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner />
          </div>
        ) : !report.hasActivity ? (
          <p className="flex h-48 items-center justify-center text-center text-[13px] text-on-surface-muted">Money in and out appears after your first payment or bill.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3" data-testid="money-in-out-totals">
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">In · {rangeLabel}</dt>
                <dd className="text-[18px] font-semibold tabular-nums text-on-surface">{money(report.totalIn)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">Out · {rangeLabel}</dt>
                <dd className="text-[18px] font-semibold tabular-nums text-on-surface">{money(report.totalOut)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">Net</dt>
                <dd className={cn("text-[18px] font-semibold tabular-nums", net > 0n && "text-paid", net < 0n && "text-overdue", net === 0n && "text-on-surface")} data-tone={net > 0n ? "positive" : net < 0n ? "negative" : "neutral"}>
                  {net > 0n ? "+" : net < 0n ? "−" : ""}
                  {money(net < 0n ? -net : net)}
                </dd>
              </div>
            </dl>
            <GroupedBarChart
              data={rows}
              series={[
                { key: "in", label: "Money in (payments received)", color: "var(--color-primary)" },
                { key: "out", label: "Money out (bills, expenses)", color: "var(--color-border-strong)" },
              ]}
              formatTick={(v) => compact.format(v / scale)}
              renderTooltip={(row) => {
                const rowNet = BigInt(String(row.inMinor)) - BigInt(String(row.outMinor));
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{monthName(String(row.key))}</span>
                    <span>In: {money(String(row.inMinor))}</span>
                    <span>Out: {money(String(row.outMinor))}</span>
                    <span>
                      Net: {rowNet > 0n ? "+" : rowNet < 0n ? "−" : ""}
                      {money(rowNet < 0n ? -rowNet : rowNet)}
                    </span>
                  </div>
                );
              }}
              aria-label={`Money in and out by month, last ${rangeLabel}`}
              description={`Over the last ${rangeLabel}: ${money(report.totalIn)} in, ${money(report.totalOut)} out.`}
              emptyState="No money in or out in this range."
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
