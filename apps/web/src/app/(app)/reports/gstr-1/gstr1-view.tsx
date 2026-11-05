"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, ReportFilter, ReportToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, StatementTable } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { useCurrency } from "../analysis-shared";
import { ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { useReportDetail } from "../report-shell";
import type { Gstr1DocumentRange, Gstr1Problem, Gstr1Summary } from "./types";
import { t, useT } from "../../../../lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MONTHS = [t("reports.gstr1.months.january"), t("reports.gstr1.months.february"), t("reports.gstr1.months.march"), t("reports.gstr1.months.april"), t("reports.gstr1.months.may"), t("reports.gstr1.months.june"), t("reports.gstr1.months.july"), t("reports.gstr1.months.august"), t("reports.gstr1.months.september"), t("reports.gstr1.months.october"), t("reports.gstr1.months.november"), t("reports.gstr1.months.december")];

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

/** "INV-0120 – INV-0147, 2 credit notes": invoice ranges, then how many credit notes. */
function documentsText(docs: readonly Gstr1DocumentRange[]): string {
  const invoices = docs.filter((d) => d.kind === "invoice").map(rangeText);
  const notes = docs.filter((d) => d.kind === "credit_note").reduce((s, d) => s + d.total, 0);
  return [...invoices, ...(notes ? [t("reports.gstr1.creditNotes", { count: notes })] : [])].join(", ") || t("reports.gstr1.noDocumentsIssued");
}

/** US-TAX-17 — what to fix before uploading, each with a link to the record. */
function ProblemsPanel({ problems }: { problems: Gstr1Problem[] }) {
  const t = useT();
  return (
    <Card data-testid="gstr1-problems">
      <CardHeader>
        <CardTitle className="text-[15px]">{t("reports.gstr1.problemsTitle")}</CardTitle>
        <CardDescription>{t("reports.gstr1.problemCount", { count: problems.length })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border border-t border-border">
          {problems.map((p) => (
            <li key={`${p.kind}-${p.recordId ?? "totals"}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[14px] text-on-surface">
              <span>{p.label}</span>
              <Link href={p.href} className="font-medium text-primary hover:underline">
                {p.action}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * US-TAX-16 (D-148) — GSTR-1 for a month or a quarter: what's in each table,
 * and the JSON file for the GST portal's offline tool. US-TAX-17 adds what
 * to fix first, the Tax Summary check and the Excel workbook. Spine prepares the
 * file; it never files the return.
 */
export function Gstr1View() {
  const t = useT();
  const currency = useCurrency();
  const [filing, setFiling] = useState<Filing>("monthly");
  const options = useMemo(() => periodOptions(filing), [filing]);
  // The period just ended: last month, or last quarter.
  const [period, setPeriod] = useState(() => periodOptions("monthly")[1]!.value);
  const { data, error, loading } = useReport<Gstr1Summary>(`/exports/gstr1?period=${period}`, FINANCIAL_STATEMENTS_NO_ACCESS);
  const money = (value: string) => formatMoney(value, currency);
  useReportDetail(data ? t("reports.gstr1.detail", { period: data.period.label, gstin: data.gstin }) : null);

  const changeFiling = (next: Filing) => {
    setFiling(next);
    setPeriod(periodOptions(next)[1]!.value);
  };

  const tables = data?.tables;
  const invoicesVoided = tables?.docs.filter((d) => d.kind === "invoice").reduce((s, d) => s + d.cancelled, 0) ?? 0;
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
            <ReportFilter label={t("reports.gstr1.filing")}>
              {(id) => (
                <Select value={filing} onValueChange={(v) => changeFiling(v as Filing)}>
                  <SelectTrigger className="w-40" aria-labelledby={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("reports.gstr1.monthly")}</SelectItem>
                    <SelectItem value="quarterly">{t("reports.gstr1.quarterly")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </ReportFilter>
            <ReportFilter label={t("reports.common.period")}>
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
            <>
              {/* US-TAX-17: the same figures as a workbook, one sheet per table plus Problems. */}
              <Button variant="secondary" asChild>
                <a href={`${API_URL}/exports/gstr1?period=${period}&format=xlsx`} data-testid="gstr1-download-xlsx">
                  <Download size={14} aria-hidden="true" />
                  {t("reports.gstr1.downloadExcel")}
                </a>
              </Button>
              <Button asChild>
                <a href={`${API_URL}/exports/gstr1?period=${period}&format=json`} data-testid="gstr1-download-json">
                  <Download size={14} aria-hidden="true" />
                  {t("reports.gstr1.downloadJson")}
                </a>
              </Button>
            </>
          )
        }
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && tables && !error && (
        <>
          <ReportKpis count={4} data-testid="gstr1-cards">
            <StatCard label={t("reports.common.documents")} value={String(data.totals.documents)} trend={{ direction: "neutral", label: documentsText(tables.docs) }} />
            <StatCard label={t("reports.gstr1.taxableValue")} value={money(data.totals.taxableValue)} trend={{ direction: "neutral", label: t("reports.gstr1.acrossEveryTable") }} />
            {/* US-TAX-17: the file's tax against the Tax Summary's tax collected. */}
            <StatCard
              label={t("reports.common.tax")}
              value={money(data.totals.tax)}
              trend={data.totalsMatchTaxSummary ? { direction: "up", label: t("reports.gstr1.equalsTaxSummary") } : { direction: "down", label: t("reports.gstr1.taxSummarySays", { amount: money(data.taxSummaryTax) }) }}
            />
            <StatCard
              label={t("reports.gstr1.problems")}
              value={String(data.problems.length)}
              trend={data.problems.length ? { direction: "down", label: t("reports.gstr1.fixBeforeUploading") } : { direction: "up", label: t("reports.gstr1.nothingToFix") }}
            />
          </ReportKpis>

          {data.problems.length > 0 && <ProblemsPanel problems={data.problems} />}

          <StatementTable
            data-testid="gstr1-tables"
            columns={[
              { key: "name", header: t("reports.gstr1.table") },
              { key: "documents", header: t("reports.common.documents"), align: "right" },
              { key: "taxable", header: t("reports.gstr1.taxableValue"), align: "right" },
              { key: "tax", header: t("reports.common.tax"), align: "right" },
            ]}
            rows={[
              line("b2b", t("reports.gstr1.b2b"), tables.b2b),
              line("b2cl", t("reports.gstr1.b2cl"), tables.b2cl),
              line("b2cs", t("reports.gstr1.b2cs"), tables.b2cs),
              line("cdnr", t("reports.gstr1.cdnr"), tables.cdnr),
              line("cdnur", t("reports.gstr1.cdnur"), tables.cdnur),
              line("exp", t("reports.gstr1.exp"), tables.exp),
              line("nil", t("reports.gstr1.nil"), tables.nil, { tax: "—" }),
              line("hsn", t("reports.gstr1.hsn"), tables.hsn, { documents: t("reports.gstr1.codes", { count: tables.hsn.count }) }),
              {
                kind: "line",
                key: "docs",
                testId: "gstr1-row-docs",
                cells: {
                  name: t("reports.gstr1.documentsIssued"),
                  documents: [tables.docs.filter((d) => d.kind === "invoice").map(rangeText).join(", ") || t("reports.gstr1.none"), ...(invoicesVoided ? [t("reports.gstr1.voided", { count: invoicesVoided })] : [])].join(" · "),
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
