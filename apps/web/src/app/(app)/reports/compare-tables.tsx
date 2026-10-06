"use client";

import { StatementTable, type StatementColumn, type StatementRow } from "@spine/ui";
import { changePercent, type CompareLine, type ProfitAndLossComparison } from "@spine/shared";
import { formatMoney } from "../../../lib/money";
import type { BalanceSheetReport, ReportAccountLine } from "./types";

/** "▲ +$6,059.53" / "▼ −$1,324.53" / "$0.00": an arrow and a sign, never colour alone. */
export function changeText(diff: bigint, currency: string): string {
  if (diff === 0n) return formatMoney(0n, currency);
  return `${diff > 0n ? "▲ +" : "▼ −"}${formatMoney(diff < 0n ? -diff : diff, currency)}`;
}

/** "▲ +16.8%" / "▼ −30.0%" / "0.0%" / "—" when the earlier figure is zero. */
export function percentText(current: bigint, previous: bigint): string {
  const pct = changePercent(current, previous);
  if (pct === null) return "—";
  if (/^-?0\.0$/.test(pct)) return "0.0%";
  return pct.startsWith("-") ? `▼ −${pct.slice(1)}%` : `▲ +${pct}%`;
}

/**
 * US-RPT-27 — Profit & Loss with comparison columns. For "Previous period"
 * and "Same period last year": this range, the other, Change and Change %.
 * For "Each month": one column per month and Total.
 */
export function PlCompareTable({ comparison, totals, currency }: { comparison: ProfitAndLossComparison; totals: { income: string; expenses: string; netProfit: string }; currency: string }) {
  const monthly = comparison.mode === "monthly";
  const money = (v: string | bigint) => formatMoney(v, currency);
  const columns: StatementColumn[] = [
    { key: "account", header: "Account" },
    ...comparison.columns.map((c, i) => ({ key: `c${i}`, header: c.label, align: "right" as const })),
    ...(monthly
      ? [{ key: "total", header: "Total", align: "right" as const }]
      : [
          { key: "change", header: "Change", align: "right" as const },
          { key: "pct", header: "Change %", align: "right" as const },
        ]),
  ];
  const cells = (label: string, amounts: string[], total: string): Record<string, React.ReactNode> => {
    const out: Record<string, React.ReactNode> = { account: label };
    amounts.forEach((a, i) => (out[`c${i}`] = money(a)));
    if (monthly) out.total = money(total);
    else {
      const [current, previous] = [BigInt(amounts[0] ?? "0"), BigInt(amounts[1] ?? "0")];
      out.change = changeText(current - previous, currency);
      out.pct = percentText(current, previous);
    }
    return out;
  };
  const lines = (key: string, list: CompareLine[]): StatementRow[] =>
    list.map((l) => ({ kind: "line", key: `${key}-${l.accountId}`, cells: cells(`${l.code} · ${l.name}`, l.amounts, l.amounts.reduce((s, a) => s + BigInt(a), 0n).toString()) }));
  const rows: StatementRow[] = [
    { kind: "section", key: "income", label: "Income" },
    ...lines("income", comparison.income),
    { kind: "subtotal", key: "total-income", cells: cells("Total income", comparison.totalIncome, totals.income) },
    { kind: "section", key: "expenses", label: "Expenses" },
    ...lines("expenses", comparison.expenses),
    { kind: "subtotal", key: "total-expenses", cells: cells("Total expenses", comparison.totalExpenses, totals.expenses) },
    { kind: "total", key: "net", cells: cells("Net profit", comparison.netProfit, totals.netProfit) },
  ];
  return <StatementTable columns={columns} rows={rows} data-testid="pl-compare-table" />;
}

/** US-RPT-27 — the Balance Sheet on two dates side by side. */
export function BsCompareTable({ report, comparison, currency, labels }: { report: BalanceSheetReport; comparison: BalanceSheetReport; currency: string; labels: [string, string] }) {
  const money = (v: string | bigint) => formatMoney(v, currency);
  const key = (l: ReportAccountLine) => l.accountId ?? `current-${l.code}`;
  const merge = (a: ReportAccountLine[], b: ReportAccountLine[]) => {
    const rows = new Map<string, { label: string; code: string; now: string; then: string }>();
    for (const l of a) rows.set(key(l), { label: `${l.code} · ${l.name}`, code: l.code, now: l.amount, then: "0" });
    for (const l of b) {
      const row = rows.get(key(l)) ?? { label: `${l.code} · ${l.name}`, code: l.code, now: "0", then: "0" };
      row.then = l.amount;
      rows.set(key(l), row);
    }
    return [...rows.entries()].sort((x, y) => x[1].code.localeCompare(y[1].code));
  };
  const cells = (label: string, now: string, then: string) => ({ account: label, now: money(now), then: money(then), change: changeText(BigInt(now) - BigInt(then), currency) });
  const sections = [
    { label: "Assets", lines: merge(report.assets, comparison.assets), total: [report.totalAssets, comparison.totalAssets] as const, totalLabel: "Total assets" },
    { label: "Liabilities", lines: merge(report.liabilities, comparison.liabilities), total: [report.totalLiabilities, comparison.totalLiabilities] as const, totalLabel: "Total liabilities" },
    { label: "Equity", lines: merge(report.equity, comparison.equity), total: [report.totalEquity, comparison.totalEquity] as const, totalLabel: "Total equity" },
  ];
  const rows: StatementRow[] = [
    ...sections.flatMap((s): StatementRow[] => [
      { kind: "section", key: s.label, label: s.label },
      ...s.lines.map(([id, l]): StatementRow => ({ kind: "line", key: `${s.label}-${id}`, cells: cells(l.label, l.now, l.then) })),
      { kind: "subtotal", key: `${s.label}-total`, cells: cells(s.totalLabel, s.total[0], s.total[1]) },
    ]),
    { kind: "total", key: "total", cells: cells("Total liabilities + equity", report.totalLiabilitiesAndEquity, comparison.totalLiabilitiesAndEquity) },
  ];
  return (
    <StatementTable
      data-testid="bs-compare-table"
      columns={[
        { key: "account", header: "Account" },
        { key: "now", header: labels[0], align: "right" },
        { key: "then", header: labels[1], align: "right" },
        { key: "change", header: "Change", align: "right" },
      ]}
      rows={rows}
    />
  );
}
