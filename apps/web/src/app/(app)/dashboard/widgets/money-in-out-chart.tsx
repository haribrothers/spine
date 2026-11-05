"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  GroupedBarChart,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@spine/ui";
import type { MoneyInOutReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { minorUnitExponent } from "@spine/shared/money";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { useDashboardBasis } from "../dashboard-basis";
import { useT } from "../../../../lib/i18n";

/** The minus sign before a negative net (a symbol, not copy). */
const MINUS = "−";

type Range = 3 | 6 | 12;

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    undefined,
    { month: "short" },
  );
}

function monthName(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
}

/**
 * US-DASH-15 — money received and money spent per month, side by side,
 * with the range's totals and net above the chart. Figures come from the
 * cash and bank accounts' journal lines (`GET /reports/money-in-out`), so
 * the chart and the books never disagree. Renders nothing on a 403, like
 * every gated widget.
 */
export function MoneyInOutChart() {
  const t = useT();
  const [months, setMonths] = useState<Range>(12);
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";
  const [report, setReport] = useState<MoneyInOutReport | null>(null);
  const [failed, setFailed] = useState(false);
  // US-DASH-26 (D-179) — Accrual: income and expenses; Cash: money in and out.
  const { basis, ready } = useDashboardBasis();
  const accrual = basis === "accrual";

  useEffect(() => {
    if (!ready) return;
    setReport(null);
    apiClient
      .get<MoneyInOutReport>(
        `/reports/money-in-out?months=${months}&basis=${basis}`,
      )
      .then((res) => {
        setReport(res);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [months, basis, ready]);

  if (failed) return null;

  const scale = 10 ** minorUnitExponent(currency);
  const compact = new Intl.NumberFormat(orgLocaleTag(), {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 0,
  });
  const money = (minor: string | bigint) =>
    formatMoney(BigInt(minor), currency);
  const rangeLabel = t("dashboard.moneyInOut.rangeLabel", { months });
  const net = report ? BigInt(report.net) : 0n;
  const rows = (report?.months ?? []).map((m) => ({
    key: m.month,
    label: monthLabel(m.month),
    in: Number(m.in),
    out: Number(m.out),
    inMinor: m.in,
    outMinor: m.out,
  }));

  return (
    <Card data-testid="money-in-out">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-[15px]">
          {accrual ? t("dashboard.moneyInOut.titleAccrual") : t("dashboard.moneyInOut.titleCash")}
        </CardTitle>
        <ToggleGroup
          type="single"
          value={String(months)}
          onValueChange={(v) => v && setMonths(Number(v) as Range)}
          aria-label={t("dashboard.moneyInOut.rangeAria")}
        >
          <ToggleGroupItem value="3" size="sm">{t("dashboard.moneyInOut.range3")}</ToggleGroupItem>
          <ToggleGroupItem value="6" size="sm">{t("dashboard.moneyInOut.range6")}</ToggleGroupItem>
          <ToggleGroupItem value="12" size="sm">{t("dashboard.moneyInOut.range12")}</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!report || !orgCurrency ? (
          <WidgetSkeleton kind="chart" />
        ) : !report.hasActivity ? (
          <p className="flex h-48 items-center justify-center text-center text-[13px] text-on-surface-muted">
            {accrual
              ? t("dashboard.moneyInOut.emptyAccrual")
              : t("dashboard.moneyInOut.emptyCash")}
          </p>
        ) : (
          <>
            <dl
              className="grid grid-cols-3 gap-3"
              data-testid="money-in-out-totals"
            >
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">
                  {accrual ? t("dashboard.moneyInOut.income") : t("dashboard.moneyInOut.in")} · {rangeLabel}
                </dt>
                <dd className="text-[18px] font-semibold tabular-nums text-on-surface">
                  {money(report.totalIn)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">
                  {accrual ? t("dashboard.moneyInOut.expenses") : t("dashboard.moneyInOut.out")} · {rangeLabel}
                </dt>
                <dd className="text-[18px] font-semibold tabular-nums text-on-surface">
                  {money(report.totalOut)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[12px] text-on-surface-muted">{t("dashboard.moneyInOut.net")}</dt>
                <dd
                  className={cn(
                    "text-[18px] font-semibold tabular-nums",
                    net > 0n && "text-paid",
                    net < 0n && "text-overdue",
                    net === 0n && "text-on-surface",
                  )}
                  data-tone={
                    net > 0n ? "positive" : net < 0n ? "negative" : "neutral"
                  }
                >
                  {net > 0n ? "+" : net < 0n ? MINUS : ""}
                  {money(net < 0n ? -net : net)}
                </dd>
              </div>
            </dl>
            <GroupedBarChart
              data={rows}
              series={[
                {
                  key: "in",
                  label: accrual ? t("dashboard.moneyInOut.income") : t("dashboard.moneyInOut.seriesInCash"),
                  color: "var(--color-primary)",
                },
                {
                  key: "out",
                  label: accrual ? t("dashboard.moneyInOut.expenses") : t("dashboard.moneyInOut.seriesOutCash"),
                  color: "var(--color-border-strong)",
                },
              ]}
              formatTick={(v) => compact.format(v / scale)}
              renderTooltip={(row) => {
                const rowNet =
                  BigInt(String(row.inMinor)) - BigInt(String(row.outMinor));
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {monthName(String(row.key))}
                    </span>
                    <span>
                      {accrual ? t("dashboard.moneyInOut.income") : t("dashboard.moneyInOut.in")}: {money(String(row.inMinor))}
                    </span>
                    <span>
                      {accrual ? t("dashboard.moneyInOut.expenses") : t("dashboard.moneyInOut.out")}:{" "}
                      {money(String(row.outMinor))}
                    </span>
                    <span>
                      {t("dashboard.moneyInOut.net")}: {rowNet > 0n ? "+" : rowNet < 0n ? MINUS : ""}
                      {money(rowNet < 0n ? -rowNet : rowNet)}
                    </span>
                  </div>
                );
              }}
              aria-label={
                accrual
                  ? t("dashboard.moneyInOut.ariaAccrual", { range: rangeLabel })
                  : t("dashboard.moneyInOut.ariaCash", { range: rangeLabel })
              }
              description={
                accrual
                  ? t("dashboard.moneyInOut.descriptionAccrual", { range: rangeLabel, in: money(report.totalIn), out: money(report.totalOut) })
                  : t("dashboard.moneyInOut.descriptionCash", { range: rangeLabel, in: money(report.totalIn), out: money(report.totalOut) })
              }
              emptyState={
                accrual
                  ? t("dashboard.moneyInOut.emptyStateAccrual")
                  : t("dashboard.moneyInOut.emptyStateCash")
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
