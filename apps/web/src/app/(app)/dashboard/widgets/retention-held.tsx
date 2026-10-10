"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@spine/ui";
import type { RetentionHeld } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";

/**
 * US-DASH-20 — retention held: the balance of 1150 Retention Receivable,
 * on how many jobs, and the three jobs holding the most, each with
 * "Release" (opens the job's release dialog). Nothing held: one quiet line.
 * Renders nothing without `reports.view_receivables`.
 */
export function RetentionHeldCard() {
  const [data, setData] = useState<RetentionHeld | null>(null);
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<RetentionHeld>("/dashboard/retention")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);

  if (data && BigInt(data.total) === 0n) {
    return (
      <Card className="py-3" data-testid="retention-held">
        <p className="text-[13px] text-on-surface-muted">
          <span className="font-semibold text-on-surface">Retention held</span> · No retention held.
        </p>
      </Card>
    );
  }

  return (
    <Card data-testid="retention-held">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Retention held
          <Link href="/jobs" className="text-[13px] font-normal text-primary hover:underline">
            View jobs
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !orgCurrency ? (
          <WidgetSkeleton kind="figure" rows={2} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
              <span className="whitespace-nowrap text-[22px] font-semibold tabular-nums leading-tight text-on-surface">{money(data.total)}</span>
              <span className="text-[13px] text-on-surface-muted">
                on {data.jobCount} {data.jobCount === 1 ? "job" : "jobs"} · in Retention Receivable until released
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {data.jobs.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 py-2.5" data-job={job.id}>
                  <span className="min-w-0 truncate text-[13px] text-on-surface" title={[job.number, job.name].filter(Boolean).join(" · ")}>{[job.number, job.name].filter(Boolean).join(" · ")}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-on-surface">{money(job.held)}</span>
                    <Link href={`/jobs/${job.id}?release=1`} className="text-[13px] text-primary hover:underline" aria-label={`Release retention on ${job.name}`}>
                      Release
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
