"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, StatCard, type TableColumn } from "@spine/ui";
import { periodLabel, type AnalysisDocumentRef, type SalesByCustomerReport, type SalesByCustomerRow, type SalesByItemReport, type SalesByItemRow } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, RangeBar, ReportTabs, useCurrency } from "../analysis-shared";

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
  const [customers, setCustomers] = useState<SalesByCustomerReport | null>(null);
  const [items, setItems] = useState<SalesByItemReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ title: string; documents: AnalysisDocumentRef[] } | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = `from=${iso(from)}&to=${iso(to)}`;
      if (tab === "customer") setCustomers(await apiClient.get<SalesByCustomerReport>(`/reports/sales-by-customer?${query}`));
      else setItems(await apiClient.get<SalesByItemReport>(`/reports/sales-by-item?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "This report didn't load. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loads once on open; "Refresh" reloads after that.
  }, []);

  const money = (v: string) => formatMoney(v, currency);
  const report = tab === "customer" ? customers : items;

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
    <div className="flex flex-col gap-6">
      <p className="-mt-4 text-[14px] text-on-surface-muted" data-testid="sales-subtitle">
        {tab === "customer" ? "Net of credit notes" : "Quantities from invoice lines, less credit notes"} · {periodLabel(iso(from), iso(to))}
      </p>
      <ReportTabs value={tab} tabs={TABS} />
      <RangeBar
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onRefresh={() => load()}
        loading={loading}
        actions={<ReportExportMenu path={`/reports/sales-by-${tab}?from=${iso(from)}&to=${iso(to)}`} search={search} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tab === "customer" && customers && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="sales-cards">
          <StatCard label="Customers" value={String(customers.totals.customers)} />
          <StatCard label="Invoices" value={String(customers.totals.invoiceCount)} />
          <StatCard label="Sales before tax" value={money(customers.totals.salesBeforeTax)} />
          <StatCard label="Total with tax" value={money(customers.totals.total)} />
        </div>
      )}
      {tab === "item" && items && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="sales-cards">
          <StatCard label="Items" value={String(items.rows.length)} />
          <StatCard label="Sales before tax" value={money(items.totals.salesBeforeTax)} />
        </div>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<BarChart3 />} title="No sales in this period" description="Issued invoices in the range show here. Pick other dates." />
        </div>
      ) : (
        <div data-testid="sales-table">
          {tab === "customer" && customers && !error && (
            <DataTable columns={customerColumns} data={customers.rows} rowKey={(r) => r.contactId} searchPlaceholder="Search customers" searchKey={(r) => r.name} onSearchChange={setSearch} configurablePageSize />
          )}
          {tab === "item" && items && !error && (
            <DataTable columns={itemColumns} data={items.rows} rowKey={(r) => r.catalogItemId ?? "none"} searchPlaceholder="Search items" searchKey={(r) => r.name} onSearchChange={setSearch} configurablePageSize />
          )}
        </div>
      )}
      {tab === "item" && <p className="text-[13px] text-on-surface-muted">Item figures read invoice lines, because the ledger keeps amounts, not quantities. They're before any whole-invoice discount; Sales by customer is the ledger figure.</p>}

      <DocumentsDialog title={drill?.title ?? ""} description="Issued invoices in this range. Click a number to open it." documents={drill?.documents ?? null} currency={currency} onClose={() => setDrill(null)} />
    </div>
  );
}
