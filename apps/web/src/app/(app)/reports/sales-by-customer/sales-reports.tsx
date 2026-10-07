"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, ReportToolbar, StatCard, type TableColumn } from "@spine/ui";
import { type AnalysisDocumentRef, type SalesByCustomerReport, type SalesByCustomerRow, type SalesByItemReport, type SalesByItemRow } from "@spine/shared";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, useReport } from "../report-kit";

const TABS = [
  { value: "customer", label: "Sales by customer", href: "/reports/sales-by-customer" },
  { value: "item", label: "Sales by item", href: "/reports/sales-by-item" },
];

const quantityText = (q: number) => q.toLocaleString(undefined, { maximumFractionDigits: 4 });

/**
 * US-RPT-28 — `ReportsSalesByCustomer`: who buys the most (from the ledger,
 * net of credit notes) and what sells (from invoice lines). A row opens
 * the list of its invoices.
 */
export function SalesReports({ tab }: { tab: "customer" | "item" }) {
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
      header: "Customer",
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDrill({ title: `Invoices for ${r.name}`, documents: r.invoices })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "invoices", header: "Invoices", align: "right", render: (r) => r.invoiceCount, sortValue: (r) => r.invoiceCount },
    { key: "sales", header: "Sales before tax", align: "right", render: (r) => <span className="tabular-nums">{money(r.salesBeforeTax)}</span>, sortValue: (r) => BigInt(r.salesBeforeTax) },
    { key: "tax", header: "Tax", align: "right", render: (r) => <span className="tabular-nums">{money(r.tax)}</span> },
    { key: "total", header: "Total", align: "right", render: (r) => <span className="tabular-nums">{money(r.total)}</span>, sortValue: (r) => BigInt(r.total) },
    { key: "share", header: "% of sales", align: "right", render: (r) => (r.percentOfSales === null ? "—" : `${r.percentOfSales}%`) },
  ];
  const itemColumns: TableColumn<SalesByItemRow>[] = [
    {
      key: "item",
      header: "Item",
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDrill({ title: `Invoices with ${r.name}`, documents: r.invoices })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "quantity", header: "Quantity", align: "right", render: (r) => <span className="tabular-nums">{quantityText(r.quantity)}</span>, sortValue: (r) => r.quantity },
    { key: "sales", header: "Sales before tax", align: "right", render: (r) => <span className="tabular-nums">{money(r.salesBeforeTax)}</span>, sortValue: (r) => BigInt(r.salesBeforeTax) },
    { key: "average", header: "Average price", align: "right", render: (r) => <span className="tabular-nums">{r.averagePrice === null ? "—" : money(r.averagePrice)}</span> },
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
          <StatCard label="Customers" value={String(customers.totals.customers)} />
          <StatCard label="Invoices" value={String(customers.totals.invoiceCount)} />
          <StatCard label="Sales before tax" value={money(customers.totals.salesBeforeTax)} />
          <StatCard label="Total with tax" value={money(customers.totals.total)} />
        </ReportKpis>
      )}
      {items && !error && (
        <ReportKpis count={3} data-testid="sales-cards">
          <StatCard label="Items" value={String(items.rows.length)} />
          <StatCard label="Sales before tax" value={money(items.totals.salesBeforeTax)} />
          <StatCard label="Top item" value={top ? money(top.salesBeforeTax) : "—"} trend={top ? { direction: "neutral", label: top.name } : undefined} />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BarChart3 />} title="No sales in this period" description="Issued invoices in the range show here. Pick other dates." />
        </div>
      ) : (
        <div data-testid="sales-table">
          {customers && !error && (
            <DataTable
              columns={customerColumns}
              data={customers.rows}
              rowKey={(r) => r.contactId}
              searchPlaceholder="Search customers"
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{
                customer: "Total",
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
              searchPlaceholder="Search items"
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ item: "Total", sales: money(items.totals.salesBeforeTax) }}
            />
          )}
        </div>
      )}
      {tab === "item" && <ReportFootnote>Item figures read invoice lines, because the ledger keeps amounts, not quantities. They&apos;re before any whole-invoice discount; Sales by customer is the ledger figure.</ReportFootnote>}

      <DocumentsDialog title={drill?.title ?? ""} description="Issued invoices in this range. Click a number to open it." documents={drill?.documents ?? null} currency={currency} onClose={() => setDrill(null)} />
    </>
  );
}
