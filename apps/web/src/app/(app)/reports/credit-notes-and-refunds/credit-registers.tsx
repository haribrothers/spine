"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileMinus } from "lucide-react";
import { Alert, AlertDescription, DataTable, EmptyState, StatCard, type TableColumn } from "@spine/ui";
import { periodLabel, type CreditRegisterReport, type CreditRegisterRow } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { day, iso, quarterStart, RangeBar, ReportTabs, useCurrency } from "../analysis-shared";

const TABS = [
  { value: "customer", label: "Credit notes and refunds", href: "/reports/credit-notes-and-refunds" },
  { value: "vendor", label: "Vendor credits", href: "/reports/vendor-credits" },
];

/**
 * US-RPT-31 — `ReportsCreditsRegister`: every credit note or vendor credit
 * in a range with how much was applied, refunded or is still held, so
 * nothing is given back twice.
 */
export function CreditRegisters({ tab }: { tab: "customer" | "vendor" }) {
  const currency = useCurrency();
  const [from, setFrom] = useState<Date>(quarterStart);
  const [to, setTo] = useState<Date>(() => new Date());
  const [report, setReport] = useState<CreditRegisterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiClient.get<CreditRegisterReport>(`/reports/${tab === "customer" ? "customer-credits" : "vendor-credits"}?from=${iso(from)}&to=${iso(to)}`));
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

  const money = (v: string) => (BigInt(v) === 0n ? "—" : formatMoney(v, currency));

  const columns: TableColumn<CreditRegisterRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (r) => (
        <Link href={r.href} className="whitespace-nowrap font-medium text-primary hover:underline">
          {r.number ?? "—"}
          {r.reference ? <span className="font-normal text-on-surface-muted"> · {r.reference}</span> : null}
        </Link>
      ),
      sortValue: (r) => r.number ?? "",
    },
    { key: "date", header: "Date", render: (r) => <span className="whitespace-nowrap">{day(r.date)}</span>, sortValue: (r) => r.date },
    { key: "contact", header: tab === "customer" ? "Customer" : "Vendor", render: (r) => r.contact.name, sortValue: (r) => r.contact.name },
    {
      key: "against",
      header: tab === "customer" ? "Invoice" : "Bill",
      render: (r) =>
        r.against ? (
          <Link href={r.against.href} className="text-primary hover:underline">
            {r.against.number ?? "—"}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "total", header: "Amount", align: "right", render: (r) => <span className="tabular-nums">{formatMoney(r.total, currency)}</span>, sortValue: (r) => BigInt(r.total) },
    { key: "applied", header: "Applied", align: "right", render: (r) => <span className="tabular-nums">{money(r.applied)}</span> },
    { key: "refunded", header: "Refunded", align: "right", render: (r) => <span className="tabular-nums">{money(r.refunded)}</span> },
    { key: "held", header: "Still held", align: "right", render: (r) => <span className="tabular-nums font-medium">{money(r.held)}</span>, sortValue: (r) => BigInt(r.held) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-4 text-[14px] text-on-surface-muted">{periodLabel(iso(from), iso(to))}</p>
      <ReportTabs value={tab} tabs={TABS} />
      <RangeBar from={from} to={to} onFrom={setFrom} onTo={setTo} onRefresh={() => load()} loading={loading} />

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="credits-cards">
          <StatCard label={tab === "customer" ? "Credited" : "Credits from vendors"} value={formatMoney(report.totals.total, currency)} trend={{ direction: "neutral", label: `${report.totals.count} ${report.totals.count === 1 ? "credit" : "credits"}` }} />
          <StatCard label="Applied" value={formatMoney(report.totals.applied, currency)} />
          <StatCard label="Refunded" value={formatMoney(report.totals.refunded, currency)} />
          <StatCard label="Still held" value={formatMoney(report.totals.held, currency)} />
        </div>
      )}

      {report && !error && report.rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<FileMinus />} title={tab === "customer" ? "No credit notes in this period" : "No vendor credits in this period"} description="Pick other dates." />
        </div>
      ) : (
        report &&
        !error && (
          <div data-testid="credits-table">
            <DataTable columns={columns} data={report.rows} rowKey={(r) => r.id} searchPlaceholder="Search credits" searchKey={(r) => `${r.number ?? ""} ${r.reference ?? ""} ${r.contact.name} ${r.against?.number ?? ""}`} configurablePageSize />
          </div>
        )
      )}
    </div>
  );
}
