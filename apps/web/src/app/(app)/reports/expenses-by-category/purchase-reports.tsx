"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, Progress, ReportToolbar, StatCard, type TableColumn } from "@spine/ui";
import { type AnalysisDocumentRef, type ExpensesByCategoryReport, type ExpensesByCategoryRow, type PurchasesByVendorReport, type PurchasesByVendorRow } from "@spine/shared";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useMyRole } from "../../../../lib/role-context";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, ReportFootnote, ReportKpis, useReport } from "../report-kit";
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
  const [account, setAccount] = useState<ExpensesByCategoryRow | null>(null);
  const [bills, setBills] = useState<{ title: string; documents: AnalysisDocumentRef[] } | null>(null);
  const [search, setSearch] = useState("");
  const url = `/reports/${tab === "category" ? "expenses-by-category" : "purchases-by-vendor"}?from=${iso(from)}&to=${iso(to)}`;
  const { data: report, error, loading } = useReport<ExpensesByCategoryReport | PurchasesByVendorReport>(url);
  const categories = tab === "category" ? (report as ExpensesByCategoryReport | null) : null;
  const vendors = tab === "vendor" ? (report as PurchasesByVendorReport | null) : null;

  const money = (v: string) => formatMoney(v, currency);
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
    <>
      <ReportTabs value={tab} tabs={TABS} />
      <ReportToolbar loading={loading} filters={<RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />} actions={!error && <ReportExportMenu path={url} search={search} />} />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {categories && !error && (
        <ReportKpis count={3} data-testid="purchases-cards">
          <StatCard label="Total expenses" value={money(categories.total)} />
          <StatCard label="Categories" value={String(categories.rows.length)} />
          <StatCard label="Largest category" value={largest ? money(largest.amount) : "—"} trend={largest ? { direction: "neutral", label: `${largest.name} · ${largest.percentOfTotal ?? "0.0"}%` } : undefined} />
        </ReportKpis>
      )}
      {vendors && !error && (
        <ReportKpis count={4} data-testid="purchases-cards">
          <StatCard label="Vendors" value={String(vendors.totals.vendors)} />
          <StatCard label="Bills" value={String(vendors.totals.billCount)} />
          <StatCard label="Before tax" value={money(vendors.totals.amountBeforeTax)} />
          <StatCard label="Total with tax" value={money(vendors.totals.total)} />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Receipt />} title={tab === "category" ? "No expenses in this period" : "No bills in this period"} description="Pick other dates." />
        </div>
      ) : (
        <div data-testid="purchases-table">
          {categories && !error && (
            <DataTable
              columns={categoryColumns}
              data={categories.rows}
              rowKey={(r) => r.accountId}
              searchPlaceholder="Search categories"
              searchKey={(r) => `${r.code} ${r.name}`}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ category: "Total", amount: money(categories.total), pct: "100%" }}
            />
          )}
          {vendors && !error && (
            <DataTable
              columns={vendorColumns}
              data={vendors.rows}
              rowKey={(r) => r.contactId}
              searchPlaceholder="Search vendors"
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ vendor: "Total", bills: vendors.totals.billCount, before: money(vendors.totals.amountBeforeTax), tax: money((BigInt(vendors.totals.total) - BigInt(vendors.totals.amountBeforeTax)).toString()), total: money(vendors.totals.total) }}
            />
          )}
        </div>
      )}
      {categories && !error && canDrill && categories.rows.length > 0 && <ReportFootnote>Click a category to see every journal entry behind it.</ReportFootnote>}

      {account && <DrilldownDialog accountId={account.accountId} accountLabel={`${account.code} — ${account.name}`} from={iso(from)} to={iso(to)} currency={currency} onClose={() => setAccount(null)} />}
      <DocumentsDialog title={bills?.title ?? ""} description="Recorded bills in this range. Click a number to open it." documents={bills?.documents ?? null} currency={currency} onClose={() => setBills(null)} />
    </>
  );
}
