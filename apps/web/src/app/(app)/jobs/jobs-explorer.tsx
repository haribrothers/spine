"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, Combobox, EmptyState, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn } from "@spine/ui";
import { HardHat, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { JobsSkeleton } from "./jobs-skeleton";
import { JobsTable } from "./jobs-table";
import { filterJobs, hasJobFilters, jobContacts, jobStats, jobsQuery, parseJobsState, type JobCard, type JobsListState, type MoneySum } from "./jobs-list-state";
import { NewJobDrawer } from "./new-job-drawer";
import { JOB_STATUS_LABELS, type Job, type JobStatus } from "./types";

const STATUS_OPTIONS = Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const ALL_CONTACTS = "__all__";

/**
 * The Jobs list page's client-side body.
 *
 * US-JOB-30 to US-JOB-33 (D-215): "New job" opens a drawer; the cards are
 * Active, Ready to bill, Over or near budget (job-profitability right
 * only) and Retention held, and the first three filter. Every job is
 * loaded once with its next milestone, milestone counts, billing and
 * costing, and filtered here; search, status, contact, card, sort and page
 * live in the address (D-210), with Refresh and a quiet refresh on coming
 * back after 30 s. Field users get their own jobs without money (US-JOB-19).
 */
export function JobsExplorer() {
  const canCreate = useCapability("jobs.edit_own");
  const canSeeBudget = useCapability("reports.view_job_profitability");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<JobsListState>(() => parseJobsState(new URLSearchParams(searchParams.toString())));
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [newOpen, setNewOpen] = useState(() => searchParams.get("new") === "1");
  const loading = useRef(false);

  /** Sets part of the list state and writes it to the address. */
  function update(patch: Partial<JobsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, jobsQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setJobs(await apiClient.get<Job[]>("/jobs?include=next_milestone,milestone_counts,billing,costing"));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement("Jobs updated");
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Could not load jobs.");
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? null))
      .catch(() => {});
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
  const orgCurrency = currency ?? jobs?.[0]?.currency ?? "USD";
  // Field users get no money (US-JOB-19), so no money cards.
  const withMoney = Boolean(jobs?.some((j) => j.contractValueAmount !== undefined));
  const stats = useMemo(() => (jobs ? jobStats(jobs, orgCurrency, canSeeBudget) : null), [jobs, orgCurrency, canSeeBudget]);
  const rows = useMemo(() => (jobs ? filterJobs(jobs, state) : null), [jobs, state]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: "All contacts" }, ...jobContacts(jobs ?? [])], [jobs]);
  const convertedQuoteIds = useMemo(() => new Set((jobs ?? []).map((j) => j.sourceQuoteId).filter((id): id is string => Boolean(id))), [jobs]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.amount > 0n || s.otherCurrencies ? `${formatMoney(s.amount, orgCurrency)}${s.otherCurrencies ? " + other currencies" : ""}` : "");

  const card = (label: string, value: string, extra: string, key: JobCard | null, hint: string, ariaHint: string, tone?: "warn") => {
    const pressed = key ? state.card === key : false;
    const inner = (
      <StatCard
        label={label}
        value={value}
        detail={extra || undefined}
        tone={tone === "warn" && Number(value) > 0 ? "warning" : "default"}
        trend={{ direction: "neutral", label: pressed ? "Showing these · press again to clear" : hint }}
        className={cn("h-full transition-colors", key && "hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!key) return inner;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${ariaHint}, ${value}`}
        onClick={() => update({ card: pressed ? "" : key })}
        className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {inner}
      </button>
    );
  };

  const search = (
    <div className="relative w-72">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder="Search jobs, numbers or sites" aria-label="Search jobs" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  const filtersOn = hasJobFilters(state);
  const clearAll = () => update({ q: "", status: [], contact: "", card: "" });
  const newJobButton = canCreate && (
    <Button onClick={() => setNewOpen(true)}>
      <Plus size={14} aria-hidden />
      New job
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {withMoney && (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", stats?.budget === null ? "lg:grid-cols-3" : "lg:grid-cols-4")} data-testid="job-stats">
          {card("Active", stats ? String(stats.active.count) : "—", stats ? money(stats.active) : "", "active", "Show these jobs", "Show active jobs")}
          {card("Ready to bill", stats ? String(stats.ready.count) : "—", stats ? money(stats.ready) : "", "ready", "Show these jobs", "Show jobs ready to bill", "warn")}
          {stats?.budget !== null && card("Over or near budget", stats ? String(stats.budget) : "—", "", "budget", "Show these jobs", "Show jobs over or near budget", "warn")}
          {card(
            "Retention held",
            stats ? formatMoney(stats.retention.amount, orgCurrency) : "—",
            "",
            null,
            stats && stats.retention.count ? `Across ${stats.retention.count} ${stats.retention.count === 1 ? "job" : "jobs"}` : "None held",
            "",
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status: status as JobStatus[] })} placeholder="Status" aria-label="Filter by status" className="w-40" />
            <Combobox
              options={contactOptions}
              value={state.contact || ALL_CONTACTS}
              onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })}
              placeholder="All contacts"
              aria-label="Filter by contact"
              className="w-56"
            />
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="jobs-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !jobs} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            {newJobButton}
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
      </div>

      {!rows ? (
        <JobsSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<HardHat />}
                title="No jobs match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<HardHat />}
                title="No jobs yet"
                description="Start a job for work you've agreed — from an accepted quote, or straight from here."
                action={
                  canCreate ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {newJobButton}
                      <Button asChild variant="secondary">
                        <Link href="/quotes">Go to quotes</Link>
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <JobsTable jobs={rows} now={today} sort={state.sort} onSortChange={(sort) => update({ sort })} page={state.page} onPageChange={(page) => update({ page })} toolbarStart={search} />
      )}

      {canCreate && <NewJobDrawer open={newOpen} onOpenChange={setNewOpen} defaultCurrency={orgCurrency} convertedQuoteIds={convertedQuoteIds} />}
    </div>
  );
}
