"use client";

import { ReportFilter, SegmentedBar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, cn } from "@spine/ui";
import { ListFilter } from "lucide-react";
import { formatMoney } from "../lib/money";
import { ReportChart, ReportKpis } from "../app/(app)/reports/report-kit";

export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

const BUCKETS: { key: AgingBucket; label: string; color: string }[] = [
  { key: "current", label: "Current", color: "var(--color-paid)" },
  { key: "0-30", label: "1–30 days", color: "var(--color-due-soon)" },
  { key: "31-60", label: "31–60 days", color: "var(--color-overdue)" },
  { key: "61-90", label: "61–90 days", color: "var(--color-overdue)" },
  { key: "90+", label: "90+ days", color: "var(--color-overdue)" },
];

/** US-PAY-29 — a card or a part of the bar chosen to filter the list by: one age, or every overdue age. */
export type AgingFilter = AgingBucket | "overdue";

/**
 * US-RPT-40 — Receivables and Payables: four KPI cards (total, current,
 * overdue, 90+ days) and one bar split across all five age buckets, each
 * named with its amount and share. With `onAgeChange` (Receivables,
 * US-PAY-29) the Current, Overdue and 90+ cards and the bar's parts are
 * pressable — pressing one filters the list, pressing it again clears it —
 * and `note` sits under the bar (the retention held, US-PAY-31). Payables
 * passes neither and is unchanged.
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
}) {
  const money = (v: string | bigint) => (BigInt(v) === 0n ? "—" : formatMoney(BigInt(v), currency));
  const overdue = BigInt(total) - BigInt(buckets.current);
  const press = onAgeChange ? (key: AgingFilter) => onAgeChange(age === key ? null : key) : null;
  const card = (key: AgingFilter, label: string, value: string, hint: string, tone: "default" | "critical") => {
    const on = age === key;
    const stat = (
      <StatCard
        label={label}
        value={value}
        tone={press ? tone : "default"}
        trend={{ direction: "neutral", label: on ? "Showing these · press again to clear" : hint }}
        className={cn("h-full", press && "transition-colors hover:border-border-strong", on && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!press) return stat;
    return (
      <button type="button" aria-pressed={on} aria-label={`Show ${label.toLowerCase()} only`} onClick={() => press(key)} className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {stat}
        <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", on ? "text-primary" : "text-on-surface-muted")} />
      </button>
    );
  };
  const selectedKeys = !age ? [] : age === "overdue" ? BUCKETS.filter((b) => b.key !== "current").map((b) => b.key) : [age];
  return (
    <>
      <ReportKpis count={4} data-testid="aging-cards">
        <StatCard label="Total outstanding" value={money(total)} trend={totalDetail ? { direction: "neutral", label: totalDetail } : undefined} className="h-full" />
        {card("current", "Current", money(buckets.current), "not yet due", "default")}
        {card("overdue", "Overdue", money(overdue), `${overdueCount} ${noun}${overdueCount === 1 ? "" : "s"}`, overdue > 0n ? "critical" : "default")}
        {card("90+", "90+ days", money(buckets["90+"]), "overdue by more than 90 days", BigInt(buckets["90+"]) > 0n ? "critical" : "default")}
      </ReportKpis>
      <ReportChart title="Outstanding by age" data-testid="aging-chart">
        <SegmentedBar
          aria-label="Outstanding by age"
          emptyState="Nothing outstanding."
          segments={BUCKETS.map((b) => ({ key: b.key, label: b.label, color: b.color, value: Number(BigInt(buckets[b.key])), formattedValue: formatMoney(BigInt(buckets[b.key]), currency) }))}
          onSegmentClick={press ? (key) => press(key as AgingBucket) : undefined}
          selectedKeys={press ? selectedKeys : undefined}
        />
        {note && <div className="mt-4 border-t border-border pt-3 text-[13px] text-on-surface-muted">{note}</div>}
      </ReportChart>
    </>
  );
}

/** "Show: All outstanding / Overdue only" for the aging pages' toolbar. */
export function OverdueFilter({ overdueOnly, onChange }: { overdueOnly: boolean; onChange: (overdueOnly: boolean) => void }) {
  return (
    <ReportFilter label="Show">
      {(id) => (
        <Select value={overdueOnly ? "overdue" : "all"} onValueChange={(v) => onChange(v === "overdue")}>
          <SelectTrigger className="w-56" aria-labelledby={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outstanding</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
          </SelectContent>
        </Select>
      )}
    </ReportFilter>
  );
}
