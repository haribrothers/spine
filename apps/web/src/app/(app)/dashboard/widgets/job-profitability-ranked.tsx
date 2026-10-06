"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";

interface JobProfitabilityRow {
  jobId: string;
  name: string;
  currency: string;
  margin: string;
  marginPct: number | null;
}

interface JobProfitabilityReport {
  jobs: JobProfitabilityRow[];
}

function MarginRow({ job }: { job: JobProfitabilityRow }) {
  const margin = BigInt(job.margin);
  const negative = margin < 0n;
  const widthPct = job.marginPct === null ? 0 : Math.min(100, Math.abs(job.marginPct));
  return (
    <Link href={`/reports`} className="flex flex-col gap-1 rounded-sm px-1 py-1.5 hover:bg-surface-secondary">
      <div className="flex items-center justify-between text-[13px]">
        <span className="truncate text-on-surface">{job.name}</span>
        <span className={`tabular-nums ${negative ? "text-overdue" : "text-paid"}`}>
          {formatMoney(margin, job.currency)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${negative ? "bg-overdue" : "bg-paid"}`} style={{ width: `${widthPct}%` }} />
      </div>
    </Link>
  );
}

/**
 * S-09.11 (dashboard v2) — job profitability, top 3 / bottom 3 by margin
 * %. Reuses GET /reports/job-profitability verbatim (already sorted by
 * margin descending) — no new backend. Each row's bar uses the semantic
 * paid/overdue palette by margin sign, not the categorical accent, same
 * rule as the AR aging donut.
 */
export function JobProfitabilityRanked() {
  const [report, setReport] = useState<JobProfitabilityReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<JobProfitabilityReport>("/reports/job-profitability?status=all")
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  const jobs = report?.jobs ?? [];
  const top = jobs.slice(0, 3);
  const bottom = jobs.length > 3 ? jobs.slice(-3).reverse() : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Job profitability
          <Link href="/reports/job-profitability" className="text-[13px] font-normal text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!report ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">No jobs yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Top performers</p>
              {top.map((job) => (
                <MarginRow key={job.jobId} job={job} />
              ))}
            </div>
            {bottom.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">Needs attention</p>
                {bottom.map((job) => (
                  <MarginRow key={job.jobId} job={job} />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
