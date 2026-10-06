"use client";

import { useState } from "react";
import { Alert, AlertDescription, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, ReportToolbar, StatCard, StatementTable, type StatementRow } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS, type CashFlowLine, type CashFlowReport } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { day, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, STATEMENT_TABS, useReport } from "../report-kit";

/**
 * US-RPT-26 — `ReportsCashFlow`: cash at start, operating, investing and
 * financing activities, net change and cash at end. A line opens the
 * accounts behind it.
 */
export function CashFlow() {
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [drill, setDrill] = useState<CashFlowLine | null>(null);
  const url = `/reports/cash-flow?from=${iso(from)}&to=${iso(to)}`;
  const { data: report, error, loading } = useReport<CashFlowReport>(url, FINANCIAL_STATEMENTS_NO_ACCESS);

  const money = (v: string | bigint) => formatMoney(v, currency);
  const change = BigInt(report?.netChange ?? "0");

  return (
    <>
      <ReportTabs value="cash-flow" tabs={STATEMENT_TABS} />
      <ReportToolbar loading={loading} filters={<RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />} actions={!error && <ReportExportMenu path={url} />} />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <ReportKpis count={3} data-testid="cash-flow-cards">
            <StatCard label="Cash at start" value={money(report.cashAtStart)} trend={{ direction: "neutral", label: day(report.from) }} />
            <StatCard
              label="Net change"
              value={money(change)}
              trend={{ direction: change > 0n ? "up" : change < 0n ? "down" : "neutral", label: change > 0n ? "▲ more cash than at the start" : change < 0n ? "▼ less cash than at the start" : "no change in the period" }}
            />
            <StatCard label="Cash at end" value={money(report.cashAtEnd)} trend={{ direction: "neutral", label: day(report.to) }} />
          </ReportKpis>

          <StatementTable
            data-testid="cash-flow-table"
            columns={[
              { key: "label", header: "Activity" },
              { key: "amount", header: "Amount", align: "right" },
            ]}
            rows={[
              ...report.sections.flatMap((section): StatementRow[] => [
                { kind: "section", key: `${section.key}-heading`, label: section.label },
                ...(section.lines.length === 0
                  ? [{ kind: "empty" as const, key: `${section.key}-empty`, label: "Nothing in this period." }]
                  : section.lines.map((line) => ({
                      kind: "line" as const,
                      key: line.key,
                      cells: {
                        label: (
                          <button type="button" className="text-left text-primary hover:underline" onClick={() => setDrill(line)}>
                            {line.label}
                          </button>
                        ),
                        amount: money(line.amount),
                      },
                    }))),
                { kind: "subtotal", key: `${section.key}-total`, testId: `cash-flow-total-${section.key}`, cells: { label: section.totalLabel, amount: money(section.total) } },
              ]),
              { kind: "total", key: "net-change", cells: { label: "Net change in cash", amount: money(change) } },
            ]}
          />

          {report.ties ? (
            <ReportFootnote data-testid="cash-flow-check">✓ Cash at end equals the total of your bank and cash accounts on {day(report.to)}. Card accounts are liabilities, not cash.</ReportFootnote>
          ) : (
            <Alert variant="critical" data-testid="cash-flow-check">
              <AlertDescription>Cash at end doesn&apos;t match your bank and cash accounts on {day(report.to)}. This has been logged; check the Trial Balance and tell your administrator.</AlertDescription>
            </Alert>
          )}
        </>
      )}

      <Dialog open={drill !== null} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{drill?.label}</DialogTitle>
            <DialogDescription>The accounts behind this line. A positive amount brought cash in.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {drill && drill.accounts.length === 0 ? (
              <p className="text-[14px] text-on-surface-muted">No account moved in this period.</p>
            ) : (
              <table className="w-full text-[14px]" data-testid="cash-flow-drilldown">
                <thead>
                  <tr className="border-b border-border text-left text-on-surface-muted">
                    <th className="py-2 font-medium">Account</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drill?.accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-on-surface">
                        {a.code} · {a.name}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
