"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, EmptyState, Input, MultiSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard, TableSkeleton, Tooltip, TooltipContent, TooltipTrigger, cn, useConfirm } from "@spine/ui";
import { EMAIL_KINDS, EMAIL_KIND_LABELS, EMAIL_LOG_STATUSES, EMAIL_LOG_STATUS_LABELS, type EmailKind, type EmailLogEntry, type EmailLogStatus, type EmailLogStatusSummary } from "@spine/shared";
import { Mail, RefreshCw, Search, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { useToast } from "../../../components/toast-host";
import { EmailSetupWarning } from "./email-setup-warning";
import { EmailsTable } from "./emails-table";
import { ActionError } from "../../../components/action-error";
import {
  EMAIL_RANGES,
  EMAIL_RANGE_LABELS,
  emailDescription,
  emailsApiQuery,
  emailsQuery,
  filterEmails,
  hasEmailFilters,
  parseEmailsState,
  type EmailRange,
  type EmailsListState,
} from "./emails-list-state";

const STATUS_OPTIONS = EMAIL_LOG_STATUSES.map((value) => ({ value, label: EMAIL_LOG_STATUS_LABELS[value] }));
const KIND_OPTIONS = EMAIL_KINDS.filter((k) => k !== "verification").map((value) => ({ value, label: EMAIL_KIND_LABELS[value] }));

const SKELETON_COLUMNS = [
  { key: "when", header: "When", width: "w-16" },
  { key: "to", header: "To", width: "w-40" },
  { key: "subject", header: "Subject", width: "w-56" },
  { key: "record", header: "Record", width: "w-20" },
  { key: "status", header: "Status", width: "w-16" },
  { key: "attempts", header: "Attempts", width: "w-12" },
];

/**
 * The email log's client-side body (US-SET-27–29, D-220): the setup
 * warning, cards for Waiting and Failed in the last 7 days (filters) and
 * Sent today; the range's emails loaded once and filtered here; search,
 * status, kind, range, record, card, sort and page in the address (D-210),
 * with Refresh and a quiet refresh after 30 s away. Retry now and Cancel
 * ask first (D-218).
 */
export function EmailsExplorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<EmailsListState>(() => parseEmailsState(new URLSearchParams(searchParams.toString())));
  const [emails, setEmails] = useState<EmailLogEntry[] | null>(null);
  const [status, setStatus] = useState<EmailLogStatusSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const loading = useRef(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const showToast = useToast();
  const apiQuery = emailsApiQuery(state, new Date(now));

  function update(patch: Partial<EmailsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, emailsQuery(next));
  }

  const load = useCallback(
    async (mode: "first" | "refresh") => {
      if (loading.current) return;
      loading.current = true;
      if (mode === "refresh") setRefreshing(true);
      try {
        const [list, summary] = await Promise.all([apiClient.get<EmailLogEntry[]>(`/emails?${apiQuery}`), apiClient.get<EmailLogStatusSummary>("/emails/status")]);
        setEmails(list);
        setStatus(summary);
        setRefreshFailed(false);
        setUpdatedAt(Date.now());
        setNow(Date.now());
        if (mode === "refresh") setAnnouncement("Email log updated");
      } catch (err) {
        if (mode === "first") setError(err instanceof Error ? err.message : "Could not load the email log.");
        else setRefreshFailed(true);
      } finally {
        loading.current = false;
        setRefreshing(false);
      }
    },
    // A new range, record or day is a new list.
    [apiQuery],
  );

  useEffect(() => {
    void load("first");
  }, [load]);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const rows = useMemo(() => (emails ? filterEmails(emails, state, today) : null), [emails, state, today]);
  const recordLabel = state.record ? (emails?.find((e) => e.entityId === state.record)?.recordLabel ?? "this record") : null;

  async function retry(email: EmailLogEntry) {
    const ok = await confirm({
      title: "Retry this email?",
      description: (
        <>
          {emailDescription(email)} goes to {email.toAddress} again now, with {email.maxAttempts} attempts.
          {email.lastError && <> Last time it failed: “{email.lastError}” — check the address on the contact first if it&apos;s wrong.</>}
        </>
      ),
      confirmLabel: "Retry email",
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.post(`/emails/${email.id}/retry`, {});
      showToast("Email queued again", `${emailDescription(email)} will be sent to ${email.toAddress} shortly.`);
      void load("refresh");
    } catch (err) {
      setActionError({ title: "Couldn't retry the email.", message: err instanceof Error ? err.message : "Try again." });
    }
  }

  async function cancel(email: EmailLogEntry) {
    const ok = await confirm({
      title: "Cancel this email?",
      description: `${emailDescription(email)} won't be sent to ${email.toAddress || "anyone"}. You can send it again from its record.`,
      confirmLabel: "Cancel email",
      danger: true,
    });
    if (!ok) return;
    setActionError(null);
    try {
      await apiClient.post(`/emails/${email.id}/cancel`, {});
      showToast("Email cancelled", `${emailDescription(email)} won't be sent.`);
      void load("refresh");
    } catch (err) {
      setActionError({ title: "Couldn't cancel the email.", message: err instanceof Error ? err.message : "Try again." });
    }
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const card = (key: "waiting" | "failed") => state.card === key;
  const search = (
    <div className="relative w-80">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder="Search recipient, subject or record" aria-label="Search emails" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasEmailFilters(state);
  const clearAll = () => update({ q: "", status: [], kind: [], record: "", card: "", range: "30" });
  const failed = status?.failedRecently ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <EmailSetupWarning status={status} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="email-stats">
        <button
          type="button"
          aria-pressed={card("waiting")}
          aria-label={`Show waiting emails, ${status?.waiting ?? 0}`}
          onClick={() => update({ card: card("waiting") ? "" : "waiting" })}
          className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Waiting"
            value={status ? String(status.waiting) : "—"}
            detail="Queued or retrying"
            trend={{ direction: "neutral", label: card("waiting") ? "Showing these · press again to clear" : "Show these emails" }}
            className={cn("h-full transition-colors hover:border-border-strong", card("waiting") && "border-primary bg-info-bg/60 ring-1 ring-primary")}
          />
        </button>
        <button
          type="button"
          aria-pressed={card("failed")}
          aria-label={`Show emails that failed in the last 7 days, ${failed}`}
          onClick={() => update({ card: card("failed") ? "" : "failed" })}
          className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Failed in the last 7 days"
            value={status ? String(failed) : "—"}
            detail="Not retried or cancelled"
            tone={failed > 0 ? "critical" : "default"}
            trend={{ direction: "neutral", label: card("failed") ? "Showing these · press again to clear" : "Show these emails" }}
            className={cn("h-full transition-colors hover:border-border-strong", card("failed") && "border-primary bg-info-bg/60 ring-1 ring-primary")}
          />
        </button>
        <StatCard label="Sent today" value={status ? String(status.sentToday) : "—"} trend={{ direction: "neutral", label: "Since midnight" }} className="h-full" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(v) => update({ status: v as EmailLogStatus[] })} placeholder="Status" aria-label="Filter by status" className="w-40" />
            <MultiSelect options={KIND_OPTIONS} value={state.kind} onValueChange={(v) => update({ kind: v as EmailKind[] })} placeholder="Kind" aria-label="Filter by kind" className="w-44" />
            <Select value={state.range} onValueChange={(v) => update({ range: v as EmailRange })}>
              <SelectTrigger aria-label="Show emails from" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EMAIL_RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recordLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-info-bg py-0.5 pl-2.5 pr-1 text-[12.5px] font-medium text-on-surface" data-testid="email-record-filter">
                Emails for {recordLabel}
                <button type="button" aria-label={`Show all emails, not just ${recordLabel}'s`} onClick={() => update({ record: "" })} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface">
                  <X size={12} aria-hidden />
                </button>
              </span>
            )}
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="emails-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !emails} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              Couldn&apos;t refresh the list. Check your connection and try again.
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-64" />
          <TableSkeleton columns={SKELETON_COLUMNS} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Mail />}
                title="No emails match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={<Mail />} title="No emails yet" description="Quotes, invoices, reminders, receipts and your team's notifications show here once Spine sends them." />
            )}
          </div>
        </div>
      ) : (
        <EmailsTable emails={rows} now={today} sort={state.sort} onSortChange={(sort) => update({ sort })} page={state.page} onPageChange={(page) => update({ page })} toolbarStart={search} onRetry={(e) => void retry(e)} onCancel={(e) => void cancel(e)} />
      )}
      {confirmDialog}
    </div>
  );
}
