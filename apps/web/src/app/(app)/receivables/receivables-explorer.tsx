"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, EmptyState, StatCard } from "@spine/ui";
import { Inbox } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { ExportCsvButton } from "../../../components/export-csv-button";
import { ReceivablesSkeleton } from "./receivables-skeleton";
import { ReceivablesTable } from "./receivables-table";
import { AGING_BUCKET_LABELS, type AgingBucket, type ReceivablesReport } from "./types";
import { formatMoney } from "../../../lib/money";

const BUCKET_ORDER: AgingBucket[] = ["current", "0-30", "31-60", "61-90", "90+"];

/**
 * S-06.7 / S-09.5 — the receivables page's client body. One stat card per
 * aging bucket (0 outstanding renders as "—" per bucket, matching
 * payments-explorer.tsx's own null-state convention) plus the full
 * outstanding-invoice list, oldest-overdue first. Currency label on each
 * stat card assumes the org's invoices share one currency (true for v1 —
 * multi-currency is an explicit non-goal per CLAUDE.md) and falls back to
 * the first invoice's own currency, or blank if there are none yet.
 */
export function ReceivablesExplorer() {
  const [report, setReport] = useState<ReceivablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const currency = report.invoices[0]?.currency ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* US-PAY-10: the file matches what's on screen, search included. */}
      <div className="flex justify-end">
        <ExportCsvButton path="/reports/receivables/export.csv" search={search} />
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

      {report.invoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<Inbox />} title="Nothing outstanding" description="Every issued invoice has been paid in full." />
        </div>
      ) : (
        <ReceivablesTable invoices={report.invoices} onSearchChange={setSearch} />
      )}
    </div>
  );
}
