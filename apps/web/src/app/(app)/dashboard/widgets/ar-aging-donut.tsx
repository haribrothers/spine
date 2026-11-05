"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, DonutChart } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney, formatMoneyCompact } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { t as translate, useT } from "../../../../lib/i18n";

type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

interface ReceivablesReport {
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
}

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];
const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: translate("dashboard.arAging.current"),
  "0-30": translate("dashboard.arAging.days1to30"),
  "31-60": translate("dashboard.arAging.days31to60"),
  "61-90": translate("dashboard.arAging.days61to90"),
  "90+": translate("dashboard.arAging.days90plus"),
};
/** Semantic financial-status palette — never the categorical accent, per chart.tsx's own doc-comment rule against mixing palettes. */
const BUCKET_COLORS: Record<AgingBucket, string> = {
  current: "var(--color-paid)",
  "0-30": "var(--color-due-soon)",
  "31-60": "var(--color-overdue)",
  "61-90": "var(--color-overdue)",
  "90+": "var(--color-overdue)",
};

/**
 * S-09.11 (dashboard v2) — AR aging as a donut, reusing
 * GET /reports/receivables' already-bucketed totals (no new backend).
 * Uses `@spine/ui`'s `DonutChart` (added alongside this widget), which
 * gives it a real legend + center total — a color-only donut with no key
 * isn't legible without hovering every segment.
 *
 * US-DASH-28 (D-209): the ring's centre has the total in short form
 * ("₹44.9L"), the one exception to D-089, with the full total under the
 * title; a narrow card puts the legend under the ring.
 */
export function ArAgingDonut() {
  const t = useT();
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<ReceivablesReport>("/reports/receivables")
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  const money = (amount: string) => formatMoney(BigInt(amount), currency);
  const segments = BUCKET_ORDER.map((bucket) => ({
    key: bucket,
    label: BUCKET_LABELS[bucket],
    value: report ? Number(BigInt(report.buckets[bucket])) / 100 : 0,
    color: BUCKET_COLORS[bucket],
    formattedValue: report ? money(report.buckets[bucket]) : "",
  }));

  return (
    <Card data-testid="ar-aging">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          {t("dashboard.widgets.arAging")}
          <Link href="/receivables" className="text-[13px] font-normal text-primary hover:underline">
            {t("dashboard.common.viewAll")}
          </Link>
        </CardTitle>
        {report && orgCurrency && (
          <CardDescription data-testid="aging-total">
            {t("dashboard.arAging.total")} <span className="font-semibold tabular-nums text-on-surface">{money(report.totalOutstanding)}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!report || !orgCurrency ? (
          <WidgetSkeleton kind="ring" />
        ) : (
          <DonutChart segments={segments} centerLabel={formatMoneyCompact(report.totalOutstanding, currency)} emptyState={t("dashboard.arAging.empty")} />
        )}
      </CardContent>
    </Card>
  );
}
