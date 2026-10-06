"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, Progress, StatCard, type TableColumn } from "@spine/ui";
import { periodLabel, type AnalysisDocumentRef, type ExpensesByCategoryReport, type ExpensesByCategoryRow, type PurchasesByVendorReport, type PurchasesByVendorRow } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useMyRole } from "../../../../lib/role-context";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, RangeBar, ReportTabs, useCurrency } from "../analysis-shared";
import { DrilldownDialog } from "../reports-explorer";

const TABS = [
  { value: "category", label: "Expenses by category", href: "/reports/expenses-by-category" },
  { value: "vendor", label: "Purchases by vendor", href: "/reports/purchases-by-vendor" },
];

/**
 * US-RPT-29 — `ReportsExpensesByCategory`: where money goes, by expense
 * account (from the ledger), and what each vendor billed, net of vendor
 * credits. A category opens the account drill-down (for those who can
 * read the ledger); a vendor opens their bills.
 */
export function PurchaseReports({ tab }: { tab: "category" | "vendor" }) {
  const currency = useCurrency();
  const isOwner = useMyRole() === "owner";
  const canReadLedger = useCapability("ledger.view");
  const canDrill = isOwner || canReadLedger;
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [categories, setCategories] = useState<ExpensesByCategoryReport | null>(null);
  const [vendors, setVendors] = useState<PurchasesByVendorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<ExpensesByCategoryRow | null>(null);
  const [bills, setBills] = useState<{ title: string; documents: AnalysisDocumentRef[] } | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = `from=${iso(from)}&to=${iso(to)}`;
      if (tab === "category") setCategories(await apiClient.get<ExpensesByCategoryReport>(`/reports/expenses-by-category?${query}`));
      else setVendors(await apiClient.get<PurchasesByVendorReport>(`/reports/purchases-by-vendor?${query}`));
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
  const report = tab === "category" ? categories : vendors;
  const largest = categories?.rows[0];

  const categoryColumns: TableColumn<ExpensesByCategoryRow>[] = [
    {
      key: "category",
      header: "Category",
      render: (r) =>
        canDrill ? (
          <button type="button" className="text-left text-primary hover:underline" onClick={() => setAccount(r)}>
            {r.code} · {r.name}
          </button>
        ) : (
          <span className="text-on-surface">
            {r.code} · {r.name}
          </span>
        ),
      sortValue: (r) => r.code,
    },
    { key: "share", header: "Share", render: (r) => <Progress className="w-48" value={Number(r.percentOfTotal ?? 0)} aria-label={`${r.name}: ${r.percentOfTotal ?? 0}% of total`} /> },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="tabular-nums">{money(r.amount)}</span>, sortValue: (r) => BigInt(r.amount) },
    { key: "pct", header: "% of total", align: "right", render: (r) => (r.percentOfTotal === null ? "—" : `${r.percentOfTotal}%`) },
  ];
  const vendorColumns: TableColumn<PurchasesByVendorRow>[] = [
    {
      key: "vendor",
      header: "Vendor",
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setBills({ title: `Bills from ${r.name}`, documents: r.bills })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "bills", header: "Bills", align: "right", render: (r) => r.billCount, sortValue: (r) => r.billCount },
    { key: "before", header: "Before tax", align: "right", render: (r) => <span className="tabular-nums">{money(r.amountBeforeTax)}</span>, sortValue: (r) => BigInt(r.amountBeforeTax) },
    { key: "tax", header: "Tax", align: "right", render: (r) => <span className="tabular-nums">{money(r.tax)}</span> },
    { key: "total", header: "Total", align: "right", render: (r) => <span className="tabular-nums">{money(r.total)}</span>, sortValue: (r) => BigInt(r.total) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-4 text-[14px] text-on-surface-muted" data-testid="purchases-subtitle">
        {tab === "category" ? "From bills, expenses, journals and money out" : "Recorded bills, net of vendor credits"} · {periodLabel(iso(from), iso(to))}
      </p>
      <ReportTabs value={tab} tabs={TABS} />
      <RangeBar
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        onRefresh={() => load()}
        loading={loading}
        actions={<ReportExportMenu path={`/reports/${tab === "category" ? "expenses-by-category" : "purchases-by-vendor"}?from=${iso(from)}&to=${iso(to)}`} search={search} />}
      />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {tab === "category" && categories && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="purchases-cards">
          <StatCard label="Total expenses" value={money(categories.total)} />
          <StatCard label="Categories" value={String(categories.rows.length)} />
          <StatCard label="Largest" value={largest?.name ?? "—"} trend={largest ? { direction: "neutral", label: `${money(largest.amount)} · ${largest.percentOfTotal ?? "0.0"}%` } : undefined} />
        </div>
      )}
      {tab === "vendor" && vendors && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="purchases-cards">
          <StatCard label="Vendors" value={String(vendors.totals.vendors)} />
          <StatCard label="Bills" value={String(vendors.totals.billCount)} />
          <StatCard label="Before tax" value={money(vendors.totals.amountBeforeTax)} />
          <StatCard label="Total with tax" value={money(vendors.totals.total)} />
        </div>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Receipt />} title={tab === "category" ? "No expenses in this period" : "No bills in this period"} description="Pick other dates." />
        </div>
      ) : (
        <div data-testid="purchases-table">
          {tab === "category" && categories && !error && (
            <DataTable columns={categoryColumns} data={categories.rows} rowKey={(r) => r.accountId} searchPlaceholder="Search categories" searchKey={(r) => `${r.code} ${r.name}`} onSearchChange={setSearch} configurablePageSize />
          )}
          {tab === "vendor" && vendors && !error && (
            <DataTable columns={vendorColumns} data={vendors.rows} rowKey={(r) => r.contactId} searchPlaceholder="Search vendors" searchKey={(r) => r.name} onSearchChange={setSearch} configurablePageSize />
          )}
        </div>
      )}

      {account && <DrilldownDialog accountId={account.accountId} accountLabel={`${account.code} — ${account.name}`} from={iso(from)} to={iso(to)} currency={currency} onClose={() => setAccount(null)} />}
      <DocumentsDialog title={bills?.title ?? ""} description="Recorded bills in this range. Click a number to open it." documents={bills?.documents ?? null} currency={currency} onClose={() => setBills(null)} />
    </div>
  );
}
