"use client";

import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { Alert, AlertDescription, Button, ReportToolbar, StatCard, StatementTable } from "@spine/ui";
import { FINANCIAL_STATEMENTS_NO_ACCESS } from "@spine/shared";
import { iso, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { useT } from "../../../../lib/i18n";
import { orgLocaleTag } from "../../../../lib/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface TallySummary {
  from: string;
  to: string;
  ledgers: number;
  vouchers: number;
  byType: { voucherType: string; label: string; count: number }[];
  defaults: { code: string; name: string; group: string }[];
}

/** The financial year so far: from 1 April for a business in rupees, 1 January otherwise. */
function yearStart(currency: string, today = new Date()): Date {
  if (currency !== "INR") return new Date(today.getFullYear(), 0, 1);
  return new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1);
}

/**
 * US-RPT-38 (D-149) — what the Tally export holds for a range: ledgers,
 * vouchers by type and the accounts still on their default group; "Export"
 * downloads the ZIP (masters.xml, vouchers.xml, README.txt).
 */
export function TallyExportView() {
  const t = useT();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date>(() => new Date());
  const start = from ?? yearStart(currency);
  const query = `from=${iso(start)}&to=${iso(to)}`;
  const { data, error, loading } = useReport<TallySummary>(`/exports/tally?${query}&format=summary`, FINANCIAL_STATEMENTS_NO_ACCESS);
  const count = (n: number) => n.toLocaleString(orgLocaleTag());

  return (
    <>
      <ReportToolbar
        loading={loading}
        filters={<RangeFilters from={start} to={to} onFrom={setFrom} onTo={setTo} />}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/reports/tally/mapping">{t("reports.tally.accountMapping")}</Link>
            </Button>
            {data && !error && (
              <Button asChild>
                <a href={`${API_URL}/exports/tally?${query}`} data-testid="tally-export">
                  <Download size={14} aria-hidden="true" />
                  {t("reports.tally.export")}
                </a>
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && !error && (
        <>
          <ReportKpis count={3} data-testid="tally-cards">
            <StatCard label={t("reports.tally.ledgers")} value={count(data.ledgers)} trend={{ direction: "neutral", label: t("reports.tally.ledgersHint") }} />
            <StatCard label={t("reports.tally.vouchers")} value={count(data.vouchers)} trend={{ direction: "neutral", label: t("reports.tally.vouchersHint") }} />
            <StatCard
              label={t("reports.tally.defaultGroups")}
              value={count(data.defaults.length)}
              trend={data.defaults.length ? { direction: "down", label: t("reports.tally.reviewMapping") } : { direction: "up", label: t("reports.tally.everyAccountMapped") }}
            />
          </ReportKpis>

          <StatementTable
            data-testid="tally-vouchers"
            columns={[
              { key: "document", header: t("reports.tally.spineDocument") },
              { key: "type", header: t("reports.tally.voucherType") },
              { key: "count", header: t("reports.tally.count"), align: "right" },
            ]}
            rows={[
              ...data.byType.map((row) => ({ kind: "line" as const, key: row.voucherType, cells: { document: row.label, type: row.voucherType, count: count(row.count) } })),
              { kind: "total" as const, key: "total", cells: { document: t("reports.common.total"), type: "", count: count(data.vouchers) } },
            ]}
          />
          <Alert data-testid="tally-howto">
            <AlertDescription>{t("reports.tally.howTo")}</AlertDescription>
          </Alert>
          <ReportFootnote>{t("reports.tally.footnote")}</ReportFootnote>
        </>
      )}
    </>
  );
}
