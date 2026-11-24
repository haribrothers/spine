"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Progress, cn } from "@spine/ui";
import { budgetUsedLabel, type BudgetState } from "@spine/shared";
import { CircleAlert } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { WidgetSkeleton } from "../dashboard-skeleton";
import { formatMoney } from "../../../../lib/money";
import { useT } from "../../../../lib/i18n";

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
 * billed % of contract, and "Budget used" with its state (US-JOB-25).
 * US-DASH-29: one column wide, so each job takes two lines. Links
 * to Job Profitability. Renders nothing without
 * `reports.view_job_profitability` (the costing fields are then absent).
 */
export function JobsInProgress() {
  const t = useT();
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
          {t("dashboard.widgets.jobsInProgress")}
          <Link href="/reports/job-profitability" className="text-[13px] font-normal text-primary hover:underline">
            {t("dashboard.widgets.jobProfitability")}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!jobs ? (
          <WidgetSkeleton kind="rows" rows={3} />
        ) : jobs.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">{t("dashboard.jobsInProgress.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-[13px]">
            {jobs.map((job) => {
              const billed = job.billedPct ?? 0;
              const over = job.budgetState === "over";
              return (
                <li key={job.id} data-job={job.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/jobs/${job.id}`} className="block truncate font-semibold text-on-surface hover:underline" title={job.name}>
                      {job.name}
                    </Link>
                    <div className="truncate text-[12px] text-on-surface-muted">{[job.number, formatMoney(BigInt(job.contractValueAmount), job.currency)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(billed, 100)} className="h-1.5 min-w-0 flex-1" aria-label={t("dashboard.jobsInProgress.billedAria", { name: job.name, billed })} />
                    <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-on-surface-muted">
                      {t("dashboard.jobsInProgress.billed", { billed })}{" "}
                      <span className={cn("inline-flex items-center gap-1", over ? "font-semibold text-overdue" : job.budgetState === "near" ? "text-due-soon" : "text-on-surface")}>
                        {over && <CircleAlert size={13} aria-hidden />}
                        {job.budgetState === "none" || job.budgetState === undefined ? t("dashboard.jobsInProgress.noBudget") : budgetUsedLabel(job.budgetState, job.budgetUsedPct)}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
