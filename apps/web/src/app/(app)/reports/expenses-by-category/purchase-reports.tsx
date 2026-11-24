"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, Progress, StatCard, type TableColumn } from "@spine/ui";
import { ReportToolbar } from "../../../../components/report-toolbar";
import { type AnalysisDocumentRef, type ExpensesByCategoryReport, type ExpensesByCategoryRow, type PurchasesByVendorReport, type PurchasesByVendorRow } from "@spine/shared";
import { useCapability } from "../../../../lib/capabilities-context";
import { formatMoney } from "../../../../lib/money";
import { useMyRole } from "../../../../lib/role-context";
import { ReportExportMenu } from "../../../../components/report-export-menu";
import { DocumentsDialog, iso, quarterStart, ReportTabs, useCurrency } from "../analysis-shared";
import { RangeFilters, rangeSummary, ReportFootnote, ReportKpis, useReport } from "../report-kit";
import { DrilldownDialog } from "../reports-explorer";
import { t, useT } from "../../../../lib/i18n";

const TABS = [
  { value: "category", label: t("reports.purchases.tabCategory"), href: "/reports/expenses-by-category" },
  { value: "vendor", label: t("reports.purchases.tabVendor"), href: "/reports/purchases-by-vendor" },
];

/**
 * US-RPT-29 — `ReportsExpensesByCategory`: where money goes, by expense
 * account (from the ledger), and what each vendor billed, net of vendor
 * credits. A category opens the account drill-down (for those who can
 * read the ledger); a vendor opens their bills.
 */
export function PurchaseReports({ tab }: { tab: "category" | "vendor" }) {
  const t = useT();
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
      header: t("reports.purchases.category"),
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
    { key: "share", header: t("reports.purchases.share"), phone: "hidden", render: (r) => <Progress className="w-48" value={Number(r.percentOfTotal ?? 0)} aria-label={t("reports.purchases.shareAria", { name: r.name, pct: r.percentOfTotal ?? 0 })} /> },
    { key: "amount", header: t("reports.common.amount"), align: "right", phone: "trailing", render: (r) => <span className="tabular-nums">{money(r.amount)}</span>, sortValue: (r) => BigInt(r.amount) },
    { key: "pct", header: t("reports.purchases.percentOfTotal"), align: "right", phone: "trailingSub", render: (r) => (r.percentOfTotal === null ? "—" : `${r.percentOfTotal}%`) },
  ];
  const vendorColumns: TableColumn<PurchasesByVendorRow>[] = [
    {
      key: "vendor",
      header: t("reports.common.vendor"),
      render: (r) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setBills({ title: t("reports.purchases.billsFrom", { name: r.name }), documents: r.bills })}>
          {r.name}
        </button>
      ),
      sortValue: (r) => r.name,
    },
    { key: "bills", header: t("reports.purchases.bills"), align: "right", render: (r) => r.billCount, sortValue: (r) => r.billCount },
    { key: "before", header: t("reports.purchases.beforeTax"), align: "right", render: (r) => <span className="tabular-nums">{money(r.amountBeforeTax)}</span>, sortValue: (r) => BigInt(r.amountBeforeTax) },
    { key: "tax", header: t("reports.common.tax"), align: "right", render: (r) => <span className="tabular-nums">{money(r.tax)}</span> },
    { key: "total", header: t("reports.common.total"), align: "right", render: (r) => <span className="tabular-nums">{money(r.total)}</span>, sortValue: (r) => BigInt(r.total) },
  ];

  return (
    <>
      <ReportTabs value={tab} tabs={TABS} />
      <ReportToolbar loading={loading} summary={rangeSummary(from, to)} filters={<RangeFilters from={from} to={to} onFrom={setFrom} onTo={setTo} />} actions={!error && <ReportExportMenu path={url} search={search} />} />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {categories && !error && (
        <ReportKpis count={3} data-testid="purchases-cards">
          <StatCard label={t("reports.common.totalExpenses")} value={money(categories.total)} />
          <StatCard label={t("reports.purchases.categories")} value={String(categories.rows.length)} />
          <StatCard label={t("reports.purchases.largestCategory")} value={largest ? money(largest.amount) : "—"} trend={largest ? { direction: "neutral", label: `${largest.name} · ${largest.percentOfTotal ?? "0.0"}%` } : undefined} />
        </ReportKpis>
      )}
      {vendors && !error && (
        <ReportKpis count={4} data-testid="purchases-cards">
          <StatCard label={t("reports.purchases.vendors")} value={String(vendors.totals.vendors)} />
          <StatCard label={t("reports.purchases.bills")} value={String(vendors.totals.billCount)} />
          <StatCard label={t("reports.purchases.beforeTax")} value={money(vendors.totals.amountBeforeTax)} />
          <StatCard label={t("reports.common.totalWithTax")} value={money(vendors.totals.total)} />
        </ReportKpis>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Receipt />} title={tab === "category" ? t("reports.purchases.emptyCategory") : t("reports.purchases.emptyVendor")} description={t("reports.common.pickOtherDates")} />
        </div>
      ) : (
        <div data-testid="purchases-table">
          {categories && !error && (
            <DataTable
              columns={categoryColumns}
              data={categories.rows}
              rowKey={(r) => r.accountId}
              searchPlaceholder={t("reports.purchases.searchCategories")}
              searchKey={(r) => `${r.code} ${r.name}`}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ category: t("reports.common.total"), amount: money(categories.total), pct: "100%" }}
            />
          )}
          {vendors && !error && (
            <DataTable
              columns={vendorColumns}
              data={vendors.rows}
              rowKey={(r) => r.contactId}
              searchPlaceholder={t("reports.purchases.searchVendors")}
              searchKey={(r) => r.name}
              onSearchChange={setSearch}
              configurablePageSize
              footer={{ vendor: t("reports.common.total"), bills: vendors.totals.billCount, before: money(vendors.totals.amountBeforeTax), tax: money((BigInt(vendors.totals.total) - BigInt(vendors.totals.amountBeforeTax)).toString()), total: money(vendors.totals.total) }}
            />
          )}
        </div>
      )}
      {categories && !error && canDrill && categories.rows.length > 0 && <ReportFootnote>{t("reports.purchases.drillNote")}</ReportFootnote>}

      {account && <DrilldownDialog accountId={account.accountId} accountLabel={`${account.code} — ${account.name}`} from={iso(from)} to={iso(to)} currency={currency} onClose={() => setAccount(null)} />}
      <DocumentsDialog title={bills?.title ?? ""} description={t("reports.purchases.billsDescription")} documents={bills?.documents ?? null} currency={currency} onClose={() => setBills(null)} />
    </>
  );
}
