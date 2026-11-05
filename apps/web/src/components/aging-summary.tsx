"use client";

import { SegmentedBar, StatCard, cn } from "@spine/ui";
import { ListFilter } from "lucide-react";
import { formatMoney } from "../lib/money";
import { ReportChart, ReportKpis } from "../app/(app)/reports/report-kit";
import { t, useT } from "../lib/i18n";

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

const BUCKETS: { key: AgingBucket; label: string; color: string }[] = [
  { key: "current", label: t("receivables.agingSummary.current"), color: "var(--color-paid)" },
  { key: "0-30", label: t("receivables.agingSummary.days0to30"), color: "var(--color-due-soon)" },
  { key: "31-60", label: t("receivables.agingSummary.days31to60"), color: "var(--color-overdue)" },
  { key: "61-90", label: t("receivables.agingSummary.days61to90"), color: "var(--color-overdue)" },
  { key: "90+", label: t("receivables.agingSummary.days90plus"), color: "var(--color-overdue)" },
];

/** US-PAY-29 — a card or a part of the bar chosen to filter the list by: one age, every overdue age, or (Payables, US-PUR-59) what's due in 7 days. */
export type AgingFilter = AgingBucket | "overdue" | "due7";

/**
 * US-RPT-40 — Receivables and Payables: four KPI cards (total, current,
 * overdue, 90+ days) and one bar split across all five age buckets, each
 * named with its amount and share. With `onAgeChange` (Receivables,
 * US-PAY-29) the Current, Overdue and 90+ cards and the bar's parts are
 * pressable — pressing one filters the list, pressing it again clears it —
 * and `note` sits under the bar (the retention held, US-PAY-31). With
 * `dueSoon` (Payables, US-PUR-59) a "Due in 7 days" card takes Current's
 * place; `totalLabel` and `chartTitle` name the figures ("Total owed").
 */
export function AgingSummary({
  buckets,
  total,
  overdueCount,
  noun,
  currency,
  totalDetail,
  age,
  onAgeChange,
  note,
  dueSoon,
  totalLabel: totalLabelProp,
  chartTitle: chartTitleProp,
}: {
  buckets: Record<AgingBucket, string>;
  total: string;
  overdueCount: number;
  noun: "invoice" | "bill";
  currency: string;
  /** Under "Total outstanding", e.g. "10 invoices · 6 customers". */
  totalDetail?: string;
  age?: AgingFilter | null;
  onAgeChange?: (age: AgingFilter | null) => void;
  note?: React.ReactNode;
  /** Not yet overdue, due within a week — shown instead of Current. */
  dueSoon?: { amount: string; count: number };
  totalLabel?: string;
  chartTitle?: string;
}) {
  const t = useT();
  const totalLabel = totalLabelProp ?? t("receivables.agingSummary.totalOutstanding");
  const chartTitle = chartTitleProp ?? t("receivables.agingSummary.outstandingByAge");
  const money = (v: string | bigint) => (BigInt(v) === 0n ? "—" : formatMoney(BigInt(v), currency));
  const overdue = BigInt(total) - BigInt(buckets.current);
  const press = onAgeChange ? (key: AgingFilter) => onAgeChange(age === key ? null : key) : null;
  const card = (key: AgingFilter, label: string, value: string, hint: string, tone: "default" | "critical" | "warning") => {
    const on = age === key;
    const stat = (
      <StatCard
        label={label}
        value={value}
        tone={press ? tone : "default"}
        trend={{ direction: "neutral", label: on ? t("receivables.agingSummary.showingThese") : hint }}
        className={cn("h-full", press && "transition-colors hover:border-border-strong", on && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!press) return stat;
    return (
      <button type="button" aria-pressed={on} aria-label={t("receivables.agingSummary.showOnly", { label: label.toLowerCase() })} onClick={() => press(key)} className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {stat}
        <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", on ? "text-primary" : "text-on-surface-muted")} />
      </button>
    );
  };
  // "Due in 7 days" is part of Current, so the bar doesn't single it out.
  const selectedKeys = !age || age === "due7" ? [] : age === "overdue" ? BUCKETS.filter((b) => b.key !== "current").map((b) => b.key) : [age];
  const countOf = (n: number) => (noun === "bill" ? t("receivables.agingSummary.billCount", { count: n }) : t("receivables.agingSummary.invoiceCount", { count: n }));
  const currentCard = !dueSoon && card("current", t("receivables.agingSummary.current"), money(buckets.current), t("receivables.agingSummary.notYetDue"), "default");
  const overdueCard = card("overdue", t("receivables.agingSummary.overdue"), money(overdue), countOf(overdueCount), overdue > 0n ? "critical" : "default");
  const dueSoonCard = dueSoon && card("due7", t("receivables.agingSummary.dueIn7Days"), money(dueSoon.amount), t("receivables.agingSummary.notYetOverdue", { counted: countOf(dueSoon.count) }), BigInt(dueSoon.amount) > 0n ? "warning" : "default");
  const oldCard = card("90+", t("receivables.agingSummary.days90plus"), money(buckets["90+"]), t("receivables.agingSummary.overdue90"), BigInt(buckets["90+"]) > 0n ? "critical" : "default");
  return (
    <>
      <ReportKpis count={4} data-testid="aging-cards">
        <StatCard label={totalLabel} value={money(total)} trend={totalDetail ? { direction: "neutral", label: totalDetail } : undefined} className="h-full" />
        {currentCard}
        {overdueCard}
        {dueSoonCard}
        {oldCard}
      </ReportKpis>
      <ReportChart title={chartTitle} data-testid="aging-chart">
        <SegmentedBar
          aria-label={chartTitle}
          emptyState={t("receivables.agingSummary.nothingOutstanding")}
          segments={BUCKETS.map((b) => ({ key: b.key, label: b.label, color: b.color, value: Number(BigInt(buckets[b.key])), formattedValue: formatMoney(BigInt(buckets[b.key]), currency) }))}
          onSegmentClick={press ? (key) => press(key as AgingBucket) : undefined}
          selectedKeys={press ? selectedKeys : undefined}
        />
        {note && <div className="mt-4 border-t border-border pt-3 text-[13px] text-on-surface-muted">{note}</div>}
      </ReportChart>
    </>
  );
}
