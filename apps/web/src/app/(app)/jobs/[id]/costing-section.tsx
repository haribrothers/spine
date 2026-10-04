"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Card, DataList, Spinner } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";
import type { Job, JobCostingReport } from "../types";
import { formatMoney } from "../../../../lib/money";

/**
 * S-04.8 — revenue/cost/margin for a job, read live off journal lines
 * (JobCostingService's own doc comment). Cost/margin show 0 today by
 * design: `journal_lines.jobId` is populated only by invoice issuance
 * (this Phase) — Purchases/Expenses, the modules that would post
 * job-tagged expense debits, are still empty stubs until Phase 4. This
 * isn't a bug to fix here; the same query starts returning real costs the
 * moment that lands, with no rework needed on this page.
 */
export function CostingSection({ job }: { job: Job }) {
  const [report, setReport] = useState<JobCostingReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<JobCostingReport>(`/jobs/${job.id}/costing`)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load job costing."));
  }, [job.id]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return (
      <Card className="flex justify-center py-8">
        <Spinner />
      </Card>
    );
  }

  const fmt = (amount: string) => formatMoney(BigInt(amount), report.currency);

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Job costing</h3>
      <DataList
        items={[
          { label: "Contract value", value: fmt(report.contractValueAmount) },
          { label: "Revenue recognised", value: fmt(report.revenue) },
          { label: "Cost", value: fmt(report.cost) },
          { label: "Margin", value: fmt(report.margin) },
          { label: "Margin %", value: report.marginPct === null ? "—" : `${report.marginPct.toFixed(1)}%` },
        ]}
      />
      <p className="text-[12px] text-on-surface-muted">
        Cost tracking goes live once purchases and expenses can be tagged to a job (a later phase) — revenue and contract value are
        accurate today.
      </p>
    </Card>
  );
}
