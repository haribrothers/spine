"use client";

import { Fragment } from "react";
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

const th = "px-4 py-3 font-medium";
const td = "px-4 py-2 tabular-nums text-right";

/**
 * US-RPT-27 — Profit & Loss with comparison columns. For "Previous period"
 * and "Same period last year": this range, the other, Change and Change %.
 * For "Each month": one column per month and Total.
 */
export function PlCompareTable({ comparison, totals, currency }: { comparison: ProfitAndLossComparison; totals: { income: string; expenses: string; netProfit: string }; currency: string }) {
  const monthly = comparison.mode === "monthly";
  const money = (v: string | bigint) => formatMoney(v, currency);
  const cells = (amounts: string[], total: string) => {
    if (monthly) {
      return (
        <>
          {amounts.map((a, i) => (
            <td key={i} className={td}>
              {money(a)}
            </td>
          ))}
          <td className={`${td} font-medium`}>{money(total)}</td>
        </>
      );
    }
    const [current, previous] = [BigInt(amounts[0] ?? "0"), BigInt(amounts[1] ?? "0")];
    return (
      <>
        <td className={td}>{money(current)}</td>
        <td className={td}>{money(previous)}</td>
        <td className={`${td} whitespace-nowrap`}>{changeText(current - previous, currency)}</td>
        <td className={`${td} whitespace-nowrap`}>{percentText(current, previous)}</td>
      </>
    );
  };
  const rows = (lines: CompareLine[]) =>
    lines.map((l) => (
      <tr key={l.accountId} className="border-b border-border">
        <td className="whitespace-nowrap px-4 py-2 text-on-surface">
          {l.code} · {l.name}
        </td>
        {cells(l.amounts, l.amounts.reduce((s, a) => s + BigInt(a), 0n).toString())}
      </tr>
    ));
  const totalRow = (label: string, amounts: string[], total: string, strong = false) => (
    <tr className={`border-b border-border font-semibold text-on-surface ${strong ? "bg-surface-sunken" : ""}`}>
      <td className="px-4 py-3">{label}</td>
      {cells(amounts, total)}
    </tr>
  );
  const section = (label: string) => (
    <tr>
      <th scope="rowgroup" colSpan={comparison.columns.length + (monthly ? 2 : 3)} className="px-4 pb-1 pt-4 text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
        {label}
      </th>
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-[14px]" data-testid="pl-compare-table">
        <thead>
          <tr className="border-b border-border text-on-surface">
            <th className={`${th} text-left`}>Account</th>
            {comparison.columns.map((c) => (
              <th key={c.from} className={`${th} whitespace-nowrap text-right`}>
                {c.label}
              </th>
            ))}
            {monthly ? (
              <th className={`${th} text-right`}>Total</th>
            ) : (
              <>
                <th className={`${th} text-right`}>Change</th>
                <th className={`${th} text-right`}>Change %</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {section("Income")}
          {rows(comparison.income)}
          {totalRow("Total income", comparison.totalIncome, totals.income)}
          {section("Expenses")}
          {rows(comparison.expenses)}
          {totalRow("Total expenses", comparison.totalExpenses, totals.expenses)}
          {totalRow("Net profit", comparison.netProfit, totals.netProfit, true)}
        </tbody>
      </table>
    </div>
  );
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
  const sections: { label: string; lines: ReturnType<typeof merge>; total: [string, string]; totalLabel: string }[] = [
    { label: "Assets", lines: merge(report.assets, comparison.assets), total: [report.totalAssets, comparison.totalAssets], totalLabel: "Total assets" },
    { label: "Liabilities", lines: merge(report.liabilities, comparison.liabilities), total: [report.totalLiabilities, comparison.totalLiabilities], totalLabel: "Total liabilities" },
    { label: "Equity", lines: merge(report.equity, comparison.equity), total: [report.totalEquity, comparison.totalEquity], totalLabel: "Total equity" },
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-[14px]" data-testid="bs-compare-table">
        <thead>
          <tr className="border-b border-border text-on-surface">
            <th className={`${th} text-left`}>Account</th>
            <th className={`${th} whitespace-nowrap text-right`}>{labels[0]}</th>
            <th className={`${th} whitespace-nowrap text-right`}>{labels[1]}</th>
            <th className={`${th} text-right`}>Change</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s.label}>
              <tr>
                <th scope="rowgroup" colSpan={4} className="px-4 pb-1 pt-4 text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
                  {s.label}
                </th>
              </tr>
              {s.lines.map(([id, l]) => (
                <tr key={id} className="border-b border-border">
                  <td className="whitespace-nowrap px-4 py-2 text-on-surface">{l.label}</td>
                  <td className={td}>{money(l.now)}</td>
                  <td className={td}>{money(l.then)}</td>
                  <td className={`${td} whitespace-nowrap`}>{changeText(BigInt(l.now) - BigInt(l.then), currency)}</td>
                </tr>
              ))}
              <tr className="border-b border-border font-semibold text-on-surface">
                <td className="px-4 py-3">{s.totalLabel}</td>
                <td className={td}>{money(s.total[0])}</td>
                <td className={td}>{money(s.total[1])}</td>
                <td className={`${td} whitespace-nowrap`}>{changeText(BigInt(s.total[0]) - BigInt(s.total[1]), currency)}</td>
              </tr>
            </Fragment>
          ))}
          <tr className="bg-surface-sunken font-semibold text-on-surface">
            <td className="px-4 py-3">Total liabilities + equity</td>
            <td className={td}>{money(report.totalLiabilitiesAndEquity)}</td>
            <td className={td}>{money(comparison.totalLiabilitiesAndEquity)}</td>
            <td className={`${td} whitespace-nowrap`}>{changeText(BigInt(report.totalLiabilitiesAndEquity) - BigInt(comparison.totalLiabilitiesAndEquity), currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
