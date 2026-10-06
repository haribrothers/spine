"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Spinner,
  StatCard,
} from "@spine/ui";
import type { CashFlowLine, CashFlowReport } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The first day of the current quarter. */
function quarterStart(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
}

/**
 * US-RPT-26 — `ReportsCashFlow`: cash at start, operating, investing and
 * financing activities, net change and cash at end. A line opens the
 * accounts behind it.
 */
export function CashFlow() {
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [currency, setCurrency] = useState("USD");
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<CashFlowLine | null>(null);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<CashFlowReport>(`/reports/cash-flow?from=${iso(from)}&to=${iso(to)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The cash flow statement didn't load. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" reloads after that.
  }, []);

  const money = (v: string | bigint) => formatMoney(v, currency);
  const change = BigInt(report?.netChange ?? "0");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={(d) => d && setFrom(d)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={(d) => d && setTo(d)} />
        </div>
        <Button variant="secondary" onClick={() => load()} disabled={loading}>
          {loading ? <Spinner size="sm" /> : "Refresh"}
        </Button>
        <div className="ml-auto">
          <ReportExportMenu path={`/reports/cash-flow?from=${iso(from)}&to=${iso(to)}`} />
        </div>
      </div>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="cash-flow-cards">
            <StatCard label="Cash at start" value={money(report.cashAtStart)} trend={{ direction: "neutral", label: day(report.from) }} />
            <StatCard
              label="Net change"
              value={money(change)}
              trend={{ direction: change > 0n ? "up" : change < 0n ? "down" : "neutral", label: change > 0n ? "▲ more cash than at the start" : change < 0n ? "▼ less cash than at the start" : "no change in the period" }}
            />
            <StatCard label="Cash at end" value={money(report.cashAtEnd)} trend={{ direction: "neutral", label: day(report.to) }} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-[14px]" data-testid="cash-flow-table">
              <tbody>
                {report.sections.map((section) => (
                  <Fragment key={section.key}>
                    <tr>
                      <th scope="rowgroup" colSpan={2} className="px-5 pb-2 pt-5 text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
                        {section.label}
                      </th>
                    </tr>
                    {section.lines.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-5 py-2 text-on-surface-muted">
                          Nothing in this period.
                        </td>
                      </tr>
                    )}
                    {section.lines.map((line) => (
                      <tr key={line.key}>
                        <td className="px-5 py-2">
                          <button type="button" className="text-left text-primary hover:underline" onClick={() => setDrill(line)}>
                            {line.label}
                          </button>
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-on-surface">{money(line.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-semibold text-on-surface" data-testid={`cash-flow-total-${section.key}`}>
                      <td className="px-5 py-3">{section.totalLabel}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{money(section.total)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {report.ties ? (
            <Alert variant="success" data-testid="cash-flow-check">
              <AlertDescription>Cash at end equals the total of your bank and cash accounts on {day(report.to)}. Card accounts are liabilities, not cash.</AlertDescription>
            </Alert>
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
    </div>
  );
}
