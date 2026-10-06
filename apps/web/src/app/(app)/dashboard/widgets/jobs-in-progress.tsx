"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Progress, Spinner, cn } from "@spine/ui";
import { budgetUsedLabel, type BudgetState } from "@spine/shared";
import { CircleAlert } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

interface JobRow {
  id: string;
  number: string | null;
  name: string;
  currency: string;
  contractValueAmount: string;
  billedPct?: number | null;
  budgetUsedPct?: number | null;
  budgetState?: BudgetState;
}

/**
 * US-DASH-20 — each active job: name, number and contract value, a bar of
 * billed % of contract, and "Budget used" with its state (US-JOB-25). Links
 * to Job Profitability. Renders nothing without
 * `reports.view_job_profitability` (the costing fields are then absent).
 */
export function JobsInProgress() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<JobRow[]>("/jobs?status=active&include=costing")
      .then((rows) => (rows.length > 0 && rows[0]!.budgetState === undefined ? setFailed(true) : setJobs(rows)))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <Card data-testid="jobs-in-progress">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Jobs in progress
          <Link href="/reports/job-profitability" className="text-[13px] font-normal text-primary hover:underline">
            Job profitability
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!jobs ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">No jobs in progress.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-on-surface-muted">
                <th className="pb-2 font-medium">Job</th>
                <th className="pb-2 font-medium">Billed of contract</th>
                <th className="pb-2 text-right font-medium">Budget used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {jobs.map((job) => {
                const billed = job.billedPct ?? 0;
                const over = job.budgetState === "over";
                return (
                  <tr key={job.id} data-job={job.id}>
                    <td className="py-2.5 pr-3">
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-on-surface hover:underline">
                        {job.name}
                      </Link>
                      <div className="text-[12px] text-on-surface-muted">{[job.number, formatMoney(BigInt(job.contractValueAmount), job.currency)].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-3">
                        <Progress value={Math.min(billed, 100)} className="h-1.5 w-full max-w-40" aria-label={`${job.name}: ${billed}% billed`} />
                        <span className="shrink-0 text-[12px] tabular-nums text-on-surface-muted">{billed}% billed</span>
                      </div>
                    </td>
                    <td className={cn("py-2.5 text-right tabular-nums", over ? "font-semibold text-overdue" : job.budgetState === "near" ? "text-due-soon" : "text-on-surface")}>
                      <span className="inline-flex items-center gap-1">
                        {over && <CircleAlert size={14} aria-hidden />}
                        {job.budgetState === "none" || job.budgetState === undefined ? "No budget" : budgetUsedLabel(job.budgetState, job.budgetUsedPct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
