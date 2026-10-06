"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, EmptyState, StatCard } from "@spine/ui";
import { HandCoins } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { PayablesSkeleton } from "./payables-skeleton";
import { PayablesTable } from "./payables-table";
import { AGING_BUCKET_LABELS, type AgingBucket, type PayablesReport } from "./types";
import { formatMoney } from "../../../lib/money";

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];

/**
 * S-07.7 — the payables page's client body, mirroring
 * receivables/receivables-explorer.tsx exactly (one stat card per aging
 * bucket, 0 outstanding renders as "—", oldest-overdue-first list). Reads
 * `GET /reports/payables`, the AP-side mirror of `GET /reports/receivables`
 * — see reports.service.ts's own doc comment on why this reads directly
 * off `vendor_bills` rather than re-deriving from journal_lines.
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

  const currency = report.bills[0]?.currency ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* US-PUR-14: the file matches what's on screen, search included. */}
      <div className="flex justify-end">
        <ReportExportMenu path="/reports/payables" csvPath="/reports/payables/export.csv" search={search} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {BUCKET_ORDER.map((bucket) => (
          <StatCard
            key={bucket}
            label={AGING_BUCKET_LABELS[bucket]}
            value={report.buckets[bucket] === "0" ? "—" : formatMoney(BigInt(report.buckets[bucket]), currency || "USD")}
          />
        ))}
      </div>

      <StatCard
        label="Total outstanding"
        value={report.totalOutstanding === "0" ? "—" : formatMoney(BigInt(report.totalOutstanding), currency || "USD")}
      />

      {report.bills.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<HandCoins />} title="Nothing outstanding" description="Every recorded vendor bill has been paid in full." />
        </div>
      ) : (
        <>
          {overdueOnly && (
            <Alert variant="info">
              <AlertDescription>
                Showing overdue bills only.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => router.replace("/payables")}>
                  Show all
                </button>
              </AlertDescription>
            </Alert>
          )}
          <PayablesTable bills={overdueOnly ? report.bills.filter((b) => b.bucket !== "current") : report.bills} onSearchChange={setSearch} />
        </>
      )}
    </div>
  );
}
