"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, ReportToolbar, StatCard, type TableColumn } from "@spine/ui";
import { type AnalysisDocumentRef, type SalesByCustomerReport, type SalesByCustomerRow, type SalesByItemReport, type SalesByItemRow } from "@spine/shared";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { t, useT } from "../../../../lib/i18n";

const TABS = [
  { value: "customer", label: t("reports.sales.tabCustomer"), href: "/reports/sales-by-customer" },
  { value: "item", label: t("reports.sales.tabItem"), href: "/reports/sales-by-item" },
];

const quantityText = (q: number) => q.toLocaleString(orgLocaleTag(), { maximumFractionDigits: 4 });

/**
 * US-RPT-28 — `ReportsSalesByCustomer`: who buys the most (from the ledger,
 * net of credit notes) and what sells (from invoice lines). A row opens
 * the list of its invoices.
 */
export function SalesReports({ tab }: { tab: "customer" | "item" }) {
  const t = useT();
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [drill, setDrill] = useState<{ title: string; documents: AnalysisDocumentRef[] } | null>(null);
  const [search, setSearch] = useState("");
  const url = `/reports/sales-by-${tab}?from=${iso(from)}&to=${iso(to)}`;
  const { data: report, error, loading } = useReport<SalesByCustomerReport | SalesByItemReport>(url);
  const customers = tab === "customer" ? (report as SalesByCustomerReport | null) : null;
  const items = tab === "item" ? (report as SalesByItemReport | null) : null;

  const money = (v: string | bigint) => formatMoney(v, currency);
  const top = items?.rows.reduce<SalesByItemRow | null>((best, r) => (!best || BigInt(r.salesBeforeTax) > BigInt(best.salesBeforeTax) ? r : best), null);

  const customerColumns: TableColumn<SalesByCustomerRow>[] = [
    {
      key: "customer",
      header: t("reports.common.customer"),
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDrill({ title: t("reports.sales.invoicesFor", { name: r.name }), documents: r.invoices })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "invoices", header: t("reports.sales.invoices"), align: "right", render: (r) => r.invoiceCount, sortValue: (r) => r.invoiceCount },
    { key: "sales", header: t("reports.sales.salesBeforeTax"), align: "right", render: (r) => <span className="tabular-nums">{money(r.salesBeforeTax)}</span>, sortValue: (r) => BigInt(r.salesBeforeTax) },
    { key: "tax", header: t("reports.common.tax"), align: "right", render: (r) => <span className="tabular-nums">{money(r.tax)}</span> },
    { key: "total", header: t("reports.common.total"), align: "right", render: (r) => <span className="tabular-nums">{money(r.total)}</span>, sortValue: (r) => BigInt(r.total) },
    { key: "share", header: t("reports.sales.percentOfSales"), align: "right", render: (r) => (r.percentOfSales === null ? "—" : `${r.percentOfSales}%`) },
  ];
  const itemColumns: TableColumn<SalesByItemRow>[] = [
    {
      key: "item",
      header: t("reports.sales.item"),
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDrill({ title: t("reports.sales.invoicesWith", { name: r.name }), documents: r.invoices })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "quantity", header: t("reports.sales.quantity"), align: "right", render: (r) => <span className="tabular-nums">{quantityText(r.quantity)}</span>, sortValue: (r) => r.quantity },
    { key: "sales", header: t("reports.sales.salesBeforeTax"), align: "right", render: (r) => <span className="tabular-nums">{money(r.salesBeforeTax)}</span>, sortValue: (r) => BigInt(r.salesBeforeTax) },
    { key: "average", header: t("reports.sales.averagePrice"), align: "right", render: (r) => <span className="tabular-nums">{r.averagePrice === null ? "—" : money(r.averagePrice)}</span> },
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

      {customers && !error && (
        <ReportKpis count={4} data-testid="sales-cards">
          <StatCard label={t("reports.sales.customers")} value={String(customers.totals.customers)} />
          <StatCard label={t("reports.sales.invoices")} value={String(customers.totals.invoiceCount)} />
          <StatCard label={t("reports.sales.salesBeforeTax")} value={money(customers.totals.salesBeforeTax)} />
          <StatCard label={t("reports.common.totalWithTax")} value={money(customers.totals.total)} />
        </ReportKpis>
      )}
      {items && !error && (
        <ReportKpis count={3} data-testid="sales-cards">
          <StatCard label={t("reports.sales.items")} value={String(items.rows.length)} />
          <StatCard label={t("reports.sales.salesBeforeTax")} value={money(items.totals.salesBeforeTax)} />
          <StatCard label={t("reports.sales.topItem")} value={top ? money(top.salesBeforeTax) : "—"} trend={top ? { direction: "neutral", label: top.name } : undefined} />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BarChart3 />} title={t("reports.sales.emptyTitle")} description={t("reports.sales.emptyDescription")} />
        </div>
      ) : (
        <div data-testid="sales-table">
          {customers && !error && (
            <DataTable
              columns={customerColumns}
              data={customers.rows}
              rowKey={(r) => r.contactId}
              searchPlaceholder={t("reports.sales.searchCustomers")}
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{
                customer: t("reports.common.total"),
                invoices: customers.totals.invoiceCount,
                sales: money(customers.totals.salesBeforeTax),
                tax: money(BigInt(customers.totals.total) - BigInt(customers.totals.salesBeforeTax)),
                total: money(customers.totals.total),
                share: "100%",
              }}
            />
          )}
          {items && !error && (
            <DataTable
              columns={itemColumns}
              data={items.rows}
              rowKey={(r) => r.catalogItemId ?? "none"}
              searchPlaceholder={t("reports.sales.searchItems")}
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ item: t("reports.common.total"), sales: money(items.totals.salesBeforeTax) }}
            />
          )}
        </div>
      )}
      {tab === "item" && <ReportFootnote>{t("reports.sales.itemFootnote")}</ReportFootnote>}

      <DocumentsDialog title={drill?.title ?? ""} description={t("reports.sales.documentsDescription")} documents={drill?.documents ?? null} currency={currency} onClose={() => setDrill(null)} />
    </>
  );
}
