"use client";

import { ReportFilter, SegmentedBar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from "@spine/ui";
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

/**
 * US-RPT-40 — Receivables and Payables: four KPI cards (total, current,
 * overdue, 90+ days) and one bar split across all five age buckets, each
 * named with its amount and share.
 */
export function AgingSummary({ buckets, total, overdueCount, noun, currency }: { buckets: Record<AgingBucket, string>; total: string; overdueCount: number; noun: "invoice" | "bill"; currency: string }) {
  const money = (v: string | bigint) => (BigInt(v) === 0n ? "—" : formatMoney(BigInt(v), currency));
  const overdue = BigInt(total) - BigInt(buckets.current);
  return (
    <>
      <ReportKpis count={4} data-testid="aging-cards">
        <StatCard label="Total outstanding" value={money(total)} />
        <StatCard label="Current" value={money(buckets.current)} trend={{ direction: "neutral", label: "not yet due" }} />
        <StatCard label="Overdue" value={money(overdue)} trend={{ direction: "neutral", label: `${overdueCount} ${noun}${overdueCount === 1 ? "" : "s"}` }} />
        <StatCard label="90+ days" value={money(buckets["90+"])} trend={{ direction: "neutral", label: "overdue by more than 90 days" }} />
      </ReportKpis>
      <ReportChart title="Outstanding by age" data-testid="aging-chart">
        <SegmentedBar
          aria-label="Outstanding by age"
          emptyState="Nothing outstanding."
          segments={BUCKETS.map((b) => ({ key: b.key, label: b.label, color: b.color, value: Number(BigInt(buckets[b.key])), formattedValue: formatMoney(BigInt(buckets[b.key]), currency) }))}
        />
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
