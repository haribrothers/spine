"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert, AlertDescription, Button, ReportFilter, ReportToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, StatementTable } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { useCurrency } from "../analysis-shared";
import { ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { useReportDetail } from "../report-shell";
import type { Gstr1DocumentRange, Gstr1Summary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Filing = "monthly" | "quarterly";

/** The last 12 months, or the last 8 quarters, newest first; the default is the one just ended. */
function periodOptions(filing: Filing, today = new Date()): { value: string; label: string }[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (filing === "monthly") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, month - i, 1);
      return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
    });
  }
  const quarter = Math.floor(month / 3);
  return Array.from({ length: 8 }, (_, i) => {
    const q = quarter - i;
    const y = year + Math.floor(q / 4);
    const n = ((q % 4) + 4) % 4;
    return { value: `${y}-Q${n + 1}`, label: `${MONTHS[n * 3]!.slice(0, 3)} – ${MONTHS[n * 3 + 2]!.slice(0, 3)} ${y}` };
  });
}

/** "INV-0120 – INV-0147" for a range; one number on its own. */
const rangeText = (r: Gstr1DocumentRange) => (r.from === r.to ? r.from : `${r.from} – ${r.to}`);
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "INV-0120 – INV-0147, 2 credit notes": invoice ranges, then how many credit notes. */
function documentsText(docs: readonly Gstr1DocumentRange[]): string {
  const invoices = docs.filter((d) => d.kind === "invoice").map(rangeText);
  const notes = docs.filter((d) => d.kind === "credit_note").reduce((s, d) => s + d.total, 0);
  return [...invoices, ...(notes ? [count(notes, "credit note", "credit notes")] : [])].join(", ") || "No documents issued";
}

/**
 * US-TAX-16 (D-148) — GSTR-1 for a month or a quarter: what's in each table,
 * and the JSON file for the GST portal's offline tool. Spine prepares the
 * file; it never files the return.
 */
export function Gstr1View() {
  const currency = useCurrency();
  const [filing, setFiling] = useState<Filing>("monthly");
  const options = useMemo(() => periodOptions(filing), [filing]);
  // The period just ended: last month, or last quarter.
  const [period, setPeriod] = useState(() => periodOptions("monthly")[1]!.value);
  const { data, error, loading } = useReport<Gstr1Summary>(`/exports/gstr1?period=${period}`, FINANCIAL_STATEMENTS_NO_ACCESS);
  const money = (value: string) => formatMoney(value, currency);
  useReportDetail(data ? `${data.period.label} · GSTIN ${data.gstin}` : null);

  const changeFiling = (next: Filing) => {
    setFiling(next);
    setPeriod(periodOptions(next)[1]!.value);
  };

  const t = data?.tables;
  const invoicesVoided = t?.docs.filter((d) => d.kind === "invoice").reduce((s, d) => s + d.cancelled, 0) ?? 0;
  const line = (key: string, name: string, figures: { count: number; taxableValue: string; tax: string }, cells: Record<string, string> = {}) => ({
    kind: "line" as const,
    key,
    testId: `gstr1-row-${key}`,
    cells: { name, documents: String(figures.count), taxable: money(figures.taxableValue), tax: money(figures.tax), ...cells },
  });

  return (
    <>
      <ReportToolbar
        loading={loading}
        filters={
          <>
            <ReportFilter label="Filing">
              {(id) => (
                <Select value={filing} onValueChange={(v) => changeFiling(v as Filing)}>
                  <SelectTrigger className="w-40" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
            <ReportFilter label="Period">
              {(id) => (
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-48" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
          </>
        }
        actions={
          data &&
          !error && (
            <Button asChild>
              <a href={`${API_URL}/exports/gstr1?period=${period}&format=json`} data-testid="gstr1-download-json">
                <Download size={14} aria-hidden="true" />
                Download JSON
              </a>
            </Button>
          )
        }
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && t && !error && (
        <>
          <ReportKpis count={3} data-testid="gstr1-cards">
            <StatCard label="Documents" value={String(data.totals.documents)} trend={{ direction: "neutral", label: documentsText(t.docs) }} />
            <StatCard label="Taxable value" value={money(data.totals.taxableValue)} trend={{ direction: "neutral", label: "Across every table" }} />
            <StatCard label="Tax" value={money(data.totals.tax)} trend={{ direction: "neutral", label: "In the file, after credit notes" }} />
          </ReportKpis>

          <StatementTable
            data-testid="gstr1-tables"
            columns={[
              { key: "name", header: "Table" },
              { key: "documents", header: "Documents", align: "right" },
              { key: "taxable", header: "Taxable value", align: "right" },
              { key: "tax", header: "Tax", align: "right" },
            ]}
            rows={[
              line("b2b", "B2B — registered customers", t.b2b),
              line("b2cl", "B2CL — large unregistered inter-state", t.b2cl),
              line("b2cs", "B2CS — other unregistered", t.b2cs),
              line("cdnr", "CDNR — credit notes, registered", t.cdnr),
              line("cdnur", "CDNUR — credit notes, unregistered", t.cdnur),
              line("exp", "Exports", t.exp),
              line("nil", "Nil, exempt and non-GST", t.nil, { tax: "—" }),
              line("hsn", "HSN summary", t.hsn, { documents: count(t.hsn.count, "code", "codes") }),
              {
                kind: "line",
                key: "docs",
                testId: "gstr1-row-docs",
                cells: {
                  name: "Documents issued",
                  documents: [t.docs.filter((d) => d.kind === "invoice").map(rangeText).join(", ") || "None", ...(invoicesVoided ? [`${invoicesVoided} void`] : [])].join(" · "),
                  taxable: "",
                  tax: "",
                },
              },
            ]}
          />
          <ReportFootnote data-testid="gstr1-footer">{data.footer}</ReportFootnote>
        </>
      )}
    </>
  );
}
