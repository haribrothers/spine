"use client";

import Link from "next/link";
import { useState } from "react";
import { FileMinus } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, ReportToolbar, StatCard, type TableColumn } from "@spine/ui";
import { type CreditRegisterReport, type CreditRegisterRow } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { day, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { t, useT } from "../../../../lib/i18n";

const TABS = [
  { value: "customer", label: t("reports.credits.tabCustomer"), href: "/reports/credit-notes-and-refunds" },
  { value: "vendor", label: t("reports.credits.tabVendor"), href: "/reports/vendor-credits" },
];

/**
 * US-RPT-31 — `ReportsCreditsRegister`: every credit note or vendor credit
 * in a range with how much was applied, refunded or is still held, so
 * nothing is given back twice.
 */
export function CreditRegisters({ tab }: { tab: "customer" | "vendor" }) {
  const t = useT();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [search, setSearch] = useState("");
  const url = `/reports/${tab === "customer" ? "customer-credits" : "vendor-credits"}?from=${iso(from)}&to=${iso(to)}`;
  const { data: report, error, loading } = useReport<CreditRegisterReport>(url);

  const money = (v: string) => (BigInt(v) === 0n ? "—" : formatMoney(v, currency));

  const columns: TableColumn<CreditRegisterRow>[] = [
    {
      key: "number",
      header: t("reports.common.number"),
      render: (r) => (
        <Link href={r.href} className="whitespace-nowrap font-medium text-primary hover:underline">
          {r.number ?? "—"}
          {r.reference ? <span className="font-normal text-on-surface-muted"> · {r.reference}</span> : null}
        </Link>
      ),
      sortValue: (r) => r.number ?? "",
    },
    { key: "date", header: t("reports.common.date"), render: (r) => <span className="whitespace-nowrap">{day(r.date)}</span>, sortValue: (r) => r.date },
    { key: "contact", header: tab === "customer" ? t("reports.common.customer") : t("reports.common.vendor"), render: (r) => r.contact.name, sortValue: (r) => r.contact.name },
    {
      key: "against",
      header: tab === "customer" ? t("reports.credits.invoice") : t("reports.credits.bill"),
      render: (r) =>
        r.against ? (
          <Link href={r.against.href} className="text-primary hover:underline">
            {r.against.number ?? "—"}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "total", header: t("reports.common.amount"), align: "right", render: (r) => <span className="tabular-nums">{formatMoney(r.total, currency)}</span>, sortValue: (r) => BigInt(r.total) },
    { key: "applied", header: t("reports.credits.applied"), align: "right", render: (r) => <span className="tabular-nums">{money(r.applied)}</span> },
    { key: "refunded", header: t("reports.credits.refunded"), align: "right", render: (r) => <span className="tabular-nums">{money(r.refunded)}</span> },
    { key: "held", header: t("reports.credits.stillHeld"), align: "right", render: (r) => <span className="tabular-nums font-medium">{money(r.held)}</span>, sortValue: (r) => BigInt(r.held) },
  ];

  return (
    <>
      <ReportTabs value={tab} tabs={TABS} />
      <ReportToolbar loading={loading} filters={<RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />} actions={!error && <ReportExportMenu path={url} search={search} />} />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <ReportKpis count={4} data-testid="credits-cards">
          <StatCard label={tab === "customer" ? t("reports.credits.credited") : t("reports.credits.creditsFromVendors")} value={formatMoney(report.totals.total, currency)} trend={{ direction: "neutral", label: t("reports.credits.count", { count: report.totals.count }) }} />
          <StatCard label={t("reports.credits.applied")} value={formatMoney(report.totals.applied, currency)} />
          <StatCard label={t("reports.credits.refunded")} value={formatMoney(report.totals.refunded, currency)} />
          <StatCard label={t("reports.credits.stillHeld")} value={formatMoney(report.totals.held, currency)} />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<FileMinus />} title={tab === "customer" ? t("reports.credits.emptyCustomer") : t("reports.credits.emptyVendor")} description={t("reports.common.pickOtherDates")} />
        </div>
      ) : (
        report &&
        !error && (
          <div data-testid="credits-table">
            <DataTable
              columns={columns}
              data={report.rows}
              rowKey={(r) => r.id}
              searchPlaceholder={t("reports.credits.search")}
              searchKey={(r) => `${r.number ?? ""} ${r.reference ?? ""} ${r.contact.name} ${r.against?.number ?? ""}`}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{
                number: t("reports.common.total"),
                total: formatMoney(report.totals.total, currency),
                applied: formatMoney(report.totals.applied, currency),
                refunded: formatMoney(report.totals.refunded, currency),
                held: formatMoney(report.totals.held, currency),
              }}
            />
          </div>
        )
      )}
      <ReportFootnote>{t("reports.credits.footnote")}</ReportFootnote>
    </>
  );
}
