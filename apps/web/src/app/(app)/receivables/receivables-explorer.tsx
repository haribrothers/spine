"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, EmptyState, ReportToolbar } from "@spine/ui";
import { Inbox } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { ReceivablesSkeleton } from "./receivables-skeleton";
import { ReceivablesTable } from "./receivables-table";
import type { ReceivablesReport } from "./types";
import { AgingSummary, OverdueFilter } from "../../../components/aging-summary";

/**
 * S-06.7 / S-09.5 / US-RPT-40 — the receivables page's client body: the
 * report layout (Show and Export, four KPI cards, the age bar) over the
 * outstanding-invoice list, oldest-overdue first. One currency (v1 has no
 * multi-currency), taken from the first invoice.
 */
export function ReceivablesExplorer() {
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // US-DASH-14: the dashboard's "Overdue" card opens ?overdue=1.
  const router = useRouter();
  const overdueOnly = useSearchParams().get("overdue") === "1";

  useEffect(() => {
    apiClient
      .get<ReceivablesReport>("/reports/receivables")
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load receivables."));
  }, []);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return <ReceivablesSkeleton />;
  }

  const currency = report.invoices[0]?.currency || "USD";
  const overdue = report.invoices.filter((r) => r.bucket !== "current");

  return (
    <div className="flex flex-col gap-6">
      {/* US-RPT-40 — the report layout: filter and Export, KPI cards, the age bar, the list. */}
      <ReportToolbar
        filters={<OverdueFilter overdueOnly={overdueOnly} onChange={(only) => router.replace(only ? "/receivables?overdue=1" : "/receivables")} />}
        actions={<ReportExportMenu path="/reports/receivables" csvPath="/reports/receivables/export.csv" search={search} />}
      />
      <AgingSummary buckets={report.buckets} total={report.totalOutstanding} overdueCount={overdue.length} noun="invoice" currency={currency} />

      {report.invoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Inbox />} title="Nothing outstanding" description="Every issued invoice has been paid in full." />
        </div>
      ) : (
        <ReceivablesTable invoices={overdueOnly ? overdue : report.invoices} onSearchChange={setSearch} />
      )}
    </div>
  );
}
