"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, EmptyState, Spinner } from "@spine/ui";
import { Inbox, RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import type { QuoteEmailQueueJob } from "../types";

const STATE_BADGE_CLASS: Record<string, string> = {
  created: "bg-draft-bg text-draft",
  retry: "bg-due-soon-bg text-due-soon",
  active: "bg-due-soon-bg text-due-soon",
};

const STATE_LABEL: Record<string, string> = {
  created: "Queued",
  retry: "Retrying",
  active: "Sending",
};

/**
 * Item 7, user feedback — reads `GET /quotes/email-queue`, a live read
 * against pg-boss's own `pgboss.job` table (via `QueueService.
 * listPendingJobs`, see that method's own comment on why this reads
 * directly rather than claiming jobs). Auto-refreshes on a short interval
 * rather than a one-shot fetch — a job's state changes on its own (retry
 * backoff, eventual success/failure) without any user action here to
 * trigger a reload, unlike every other list page in this app.
 */
export function EmailQueueView() {
  const [jobs, setJobs] = useState<QuoteEmailQueueJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setRefreshing(true);
    apiClient
      .get<QuoteEmailQueueJob[]>("/quotes/email-queue")
      .then(setJobs)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the email queue."))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-on-surface-muted">Refreshes automatically every 10 seconds.</p>
        <Button variant="secondary" size="sm" onClick={() => load()} disabled={refreshing}>
          {refreshing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
          Refresh
        </Button>
      </div>

      {!jobs ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-border">
          <EmptyState
            icon={<Inbox />}
            title="Nothing pending"
            description="Every recently sent quote's email has either delivered or permanently failed — check the quote itself for the outcome."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[14px]">
            <thead className="border-b border-border bg-surface-sunken text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
              <tr>
                <th className="px-4 py-2.5">Quote</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Attempts</th>
                <th className="px-4 py-2.5">Queued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.jobId}>
                  <td className="px-4 py-2.5">
                    <Link href={`/quotes/${job.quoteId}`} className="font-medium text-on-surface hover:text-primary hover:underline">
                      {job.quoteNumber ?? "Draft quote"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">{job.contactName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={STATE_BADGE_CLASS[job.state] ?? ""}>{STATE_LABEL[job.state] ?? job.state}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">
                    {job.retryCount + 1} / {job.retryLimit + 1}
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">{new Date(job.createdOn).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
