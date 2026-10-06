"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, EmptyState, ReportToolbar } from "@spine/ui";
import { HandCoins } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { PayablesSkeleton } from "./payables-skeleton";
import { PayablesTable } from "./payables-table";
import type { PayablesReport } from "./types";
import { AgingSummary, OverdueFilter } from "../../../components/aging-summary";

/**
 * S-07.7 / US-RPT-40 — the payables page's client body, mirroring
 * receivables/receivables-explorer.tsx: the report layout over the
 * outstanding-bill list. Reads `GET /reports/payables`, the AP-side mirror
 * of `GET /reports/receivables` — see reports.service.ts's own doc comment
 * on why this reads directly off `vendor_bills`.
 */
export function PayablesExplorer() {
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  // US-DASH-21 — the dashboard's "Overdue" opens this filtered to overdue bills.
  const overdueOnly = useSearchParams().get("overdue") === "1";

  useEffect(() => {
    apiClient
      .get<PayablesReport>("/reports/payables")
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payables."));
  }, []);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return <PayablesSkeleton />;
  }

  const currency = report.bills[0]?.currency || "USD";
  const overdue = report.bills.filter((r) => r.bucket !== "current");

  return (
    <div className="flex flex-col gap-6">
      {/* US-RPT-40 — the report layout: filter and Export, KPI cards, the age bar, the list. */}
      <ReportToolbar
        filters={<OverdueFilter overdueOnly={overdueOnly} onChange={(only) => router.replace(only ? "/payables?overdue=1" : "/payables")} />}
        actions={<ReportExportMenu path="/reports/payables" csvPath="/reports/payables/export.csv" search={search} />}
      />
      <AgingSummary buckets={report.buckets} total={report.totalOutstanding} overdueCount={overdue.length} noun="bill" currency={currency} />

      {report.bills.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<HandCoins />} title="Nothing outstanding" description="Every recorded vendor bill has been paid in full." />
        </div>
      ) : (
        <PayablesTable bills={overdueOnly ? overdue : report.bills} onSearchChange={setSearch} />
      )}
    </div>
  );
}
