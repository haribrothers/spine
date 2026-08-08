"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Spinner,
} from "@spine/ui";
import { Inbox, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import type { QuoteEmailQueueJob } from "./types";

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
 * Item 7, user feedback (originally a standalone `/quotes/email-queue`
 * page, now a popup per follow-up request) — a cross-quote view of every
 * not-yet-resolved `quote-send-email` job. `trigger` lets each call site
 * supply its own opener (a toolbar button on the list page, an inline text
 * link inside quote-detail.tsx's failed-email alert) while sharing one
 * implementation. Polling only runs while the dialog is actually open —
 * unlike the old standalone page (which polled for as long as it was
 * mounted), a closed dialog has nothing rendered to poll for.
 */
export function EmailQueueDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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
    if (!open) return;
    load();
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="lg" className="flex max-h-[80vh] flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle>Email queue</DialogTitle>
          <DialogDescription>Quote emails that are queued, retrying, or still in flight.</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="critical">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
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
              <div className="overflow-auto rounded-lg border border-border">
                <table className="w-full text-[14px]">
                  <thead className="sticky top-0 border-b border-border bg-surface-sunken text-left text-[12px] font-semibold uppercase tracking-wide text-on-surface-muted">
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
                          <Link
                            href={`/quotes/${job.quoteId}`}
                            onClick={() => setOpen(false)}
                            className="font-medium text-on-surface hover:text-primary hover:underline"
                          >
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
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A ready-made "Email queue" button, for the common case of a toolbar trigger — see quotes-explorer.tsx. */
export function EmailQueueButton() {
  return (
    <EmailQueueDialog
      trigger={
        <Button variant="secondary">
          <Mail size={14} />
          Email queue
        </Button>
      }
    />
  );
}
