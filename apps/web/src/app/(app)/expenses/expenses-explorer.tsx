"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, Combobox, EmptyState, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn } from "@spine/ui";
import { ListFilter, Plus, Receipt, RefreshCw, Search } from "lucide-react";
import { useModule } from "../../../lib/modules-context";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useMyRole } from "../../../lib/role-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { useToast } from "../../../components/toast-host";
import { ActionError } from "../../../components/action-error";
import { JobFilter, JobFilterNote, useJobFilter } from "../../../components/job-filter";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { ExpenseForm } from "./expense-form";
import { ExpensesSkeleton } from "./expenses-skeleton";
import { ExpensesTable } from "./expenses-table";
import { ExpensesBulkBar } from "./expenses-bulk-bar";
import { ApproveExpenseDialog, RejectExpenseDialog } from "./expense-review-dialogs";
import { expenseLabel } from "./expense-row-actions";
import { expensesDescription, useCanManageExpenseCategories } from "./expenses-header";
import {
  EXPENSE_STATES,
  EXPENSE_STATE_LABELS,
  ME,
  canReviewThis,
  expenseStats,
  expensesQuery,
  filterExpenses,
  hasExpenseFilters,
  parseExpensesState,
  type ExpenseCard,
  type ExpenseState,
  type ExpensesListState,
} from "./expense-state";
import type { Expense, ExpenseCategory } from "./types";
import { useT } from "../../../lib/i18n";

const ALL = "__all__";
const STATE_OPTIONS = EXPENSE_STATES.map((s) => ({ value: s, label: EXPENSE_STATE_LABELS[s] }));

/**
 * The Expenses list (US-PUR-42, D-227): cards in money — Waiting for
 * approval (other people's, for an approver), Approved this month, Ready to
 * bill and Rejected (all but Approved this month filter) — then the list
 * layout every refined list shares: state, category, submitted by and job
 * on the left of the filter bar with Updated, Refresh and Submit expense on
 * the right; search and Columns below; newest first; everything in the
 * address (D-210). Rows act through their menu; approvers tick rows to
 * approve or reject together (US-PUR-21). An expense opens on its own page
 * (US-PUR-43); old `?id=` links go there.
 */
export function ExpensesExplorer({ currentUserId }: { currentUserId: string | null }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useMyRole();
  const isOwner = role === "owner";
  const canApprove = useCapability("expenses.approve");
  const canReject = useCapability("expenses.reject");
  const canCreate = useCapability("expenses.edit_own");
  const canManageCategories = useCanManageExpenseCategories();
  const jobsOn = useModule("jobsField");
  const job = useJobFilter();
  const canViewCosting = useCapability("reports.view_job_profitability");
  const [state, setState] = useState<ExpensesListState>(() => parseExpensesState(new URLSearchParams(searchParams.toString())));
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(() => searchParams.get("new") === "1");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [approving, setApproving] = useState<Expense | null>(null);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const loading = useRef(false);
  const showToast = useToast();
  const jobQuery = job.filtering ? job.jobId : null;

  // US-PUR-43: an expense opens on its own page; old links that opened the drawer go there.
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) router.replace(`/expenses/${id}`);
  }, [searchParams, router]);

  function update(patch: Partial<ExpensesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    replaceQuery(pathname, expensesQuery(next, jobQuery));
  }

  const load = useCallback(
    async (mode: "first" | "refresh") => {
      if (loading.current) return;
      loading.current = true;
      if (mode === "refresh") setRefreshing(true);
      try {
        const rows = await apiClient.get<Expense[]>(`/expenses${jobQuery ? `?jobId=${jobQuery}` : ""}`);
        setExpenses(rows);
        setSelected((current) => new Set([...current].filter((id) => rows.some((e) => e.id === id && e.status === "submitted"))));
        setRefreshFailed(false);
        setUpdatedAt(Date.now());
        setNow(Date.now());
        if (mode === "refresh") setAnnouncement(t("expenses.explorer.updated"));
      } catch (err) {
        if (mode === "first") setError(err instanceof Error ? err.message : t("expenses.explorer.loadFailed"));
        else setRefreshFailed(true);
      } finally {
        loading.current = false;
        setRefreshing(false);
      }
    },
    [jobQuery, t],
  );

  useEffect(() => {
    void load("first");
  }, [load]);

  useEffect(() => {
    apiClient
      .get<ExpenseCategory[]>("/expense-categories?includeArchived=true")
      .then(setCategories)
      .catch(() => {});
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? null))
      .catch(() => {});
  }, []);

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
  const orgCurrency = currency ?? expenses?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (expenses ? expenseStats(expenses, orgCurrency, today, currentUserId, canApprove && !isOwner) : null), [expenses, orgCurrency, today, currentUserId, canApprove, isOwner]);
  const rows = useMemo(() => {
    if (!expenses) return null;
    const shown = filterExpenses(expenses, state, currentUserId, canApprove && !isOwner);
    return state.sort ? shown : [...shown].sort((a, b) => `${b.date.slice(0, 10)}${b.createdAt}`.localeCompare(`${a.date.slice(0, 10)}${a.createdAt}`));
  }, [expenses, state, currentUserId, canApprove, isOwner]);
  // US-PUR-21: only what I may review goes in the bar (Staff can't review their own, D-085).
  const selectedExpenses = useMemo(() => (expenses ?? []).filter((e) => selected.has(e.id) && canReviewThis(e, currentUserId, isOwner)), [expenses, selected, currentUserId, isOwner]);
  const people = useMemo(() => {
    const byId = new Map<string, string>();
    for (const e of expenses ?? []) if (e.submittedByUserId && e.submittedByUserId !== currentUserId) byId.set(e.submittedByUserId, e.submittedByName ?? t("expenses.explorer.someone"));
    return [{ value: ALL, label: t("expenses.explorer.anyone") }, { value: ME, label: t("expenses.explorer.me") }, ...[...byId.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))];
  }, [expenses, currentUserId, t]);
  // US-PUR-46: archived categories can still be filtered on (the Categories table links to them).
  const categoryOptions = useMemo(() => [{ value: ALL, label: t("expenses.explorer.allCategories") }, ...categories.map((c) => ({ value: c.id, label: c.archivedAt ? t("expenses.explorer.archivedCategory", { name: c.name }) : c.name }))], [categories, t]);

  /** After an action: what happened (D-223), and the list again. */
  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    void load("refresh");
  }
  const handlers = {
    onDone: done,
    onFailed: (title: string, message: string) => setActionError({ title, message }),
    onEdit: (expense: Expense) => {
      setEditing(expense);
      setFormOpen(true);
    },
    onApprove: (expense: Expense) => setApproving(expense),
    onReject: (expense: Expense) => setRejecting(expense),
  };

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (v: bigint) => formatMoney(v, orgCurrency);
  const countOf = (n: number) => t("expenses.explorer.count", { count: n });
  const card = (key: Exclude<ExpenseCard, "">, label: string, value: string, hint: string, tone: "default" | "warning" = "default") => {
    const on = state.card === key;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={t("expenses.explorer.showOnly", { label: label.toLowerCase() })}
        onClick={() => update({ card: on ? "" : key })}
        className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <StatCard
          label={label}
          value={value}
          tone={tone}
          trend={{ direction: "neutral", label: on ? t("expenses.explorer.showingThese") : hint }}
          className={cn("h-full transition-colors hover:border-border-strong", on && "border-primary bg-info-bg/60 ring-1 ring-primary")}
        />
        <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", on ? "text-primary" : "text-on-surface-muted")} />
      </button>
    );
  };

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("expenses.explorer.searchPlaceholder")} aria-label={t("expenses.explorer.searchAria")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasExpenseFilters(state) || job.filtering;
  const clearAll = () => {
    update({ states: [], category: "", by: "", card: "", q: "" });
    if (job.filtering) job.setJobId("__all__");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="expense-stats">
        {/* eslint-disable i18next/no-literal-string -- card()'s keys and tones are codes, not copy */}
        {card("wait", t("expenses.state.wait"), stats ? money(stats.waiting.amount) : "—", stats ? `${countOf(stats.waiting.count)}${canApprove && !isOwner ? t("expenses.explorer.fromOthers") : ""}` : "", stats && stats.waiting.count > 0 ? "warning" : "default")}
        <StatCard label={t("expenses.explorer.approvedThisMonth")} value={stats ? money(stats.approvedThisMonth.amount) : "—"} trend={{ direction: "neutral", label: stats ? countOf(stats.approvedThisMonth.count) : "" }} className="h-full" />
        {card("bill", t("expenses.explorer.readyToBill"), stats ? money(stats.toBill.amount) : "—", stats ? `${countOf(stats.toBill.count)}${t("expenses.explorer.toBillHint")}` : "")}
        {card("rej", t("expenses.explorer.rejected"), stats ? String(stats.rejected.count) : "—", t("expenses.explorer.toFix"))}
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATE_OPTIONS} value={state.states} onValueChange={(v) => update({ states: v as ExpenseState[] })} placeholder={t("expenses.explorer.statePlaceholder")} aria-label={t("expenses.common.filterByState")} className="w-44" />
            <Combobox options={categoryOptions} value={state.category || ALL} onValueChange={(v) => update({ category: v === ALL ? "" : v })} placeholder={t("expenses.explorer.allCategories")} aria-label={t("expenses.explorer.filterByCategory")} className="w-48" />
            {role !== "field" && <Combobox options={people} value={state.by || ALL} onValueChange={(v) => update({ by: v === ALL ? "" : v })} placeholder={t("expenses.explorer.submittedByPlaceholder")} aria-label={t("expenses.explorer.filterBySubmitter")} className="w-44" />}
            {/* US-SET-24 */}
            {jobsOn && <JobFilter value={job.jobId} options={job.options} onValueChange={job.setJobId} />}
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("expenses.common.clearFilters")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="expenses-updated">
                {refreshing ? t("expenses.common.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("expenses.common.refreshList")} aria-busy={refreshing} disabled={refreshing || !expenses} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("expenses.common.refreshList")}</TooltipContent>
            </Tooltip>
            {canCreate && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus size={14} aria-hidden />
                {t("expenses.common.submitExpense")}
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("expenses.common.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("expenses.common.tryAgainButton")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {job.filtering && job.selectedLabel && <JobFilterNote kind="expenses" jobId={job.jobId} label={job.selectedLabel} canViewCosting={canViewCosting} />}

      {!rows ? (
        <ExpensesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Receipt />}
                title={job.filtering && !hasExpenseFilters(state) ? t("expenses.explorer.noneOnJob") : t("expenses.explorer.noneMatch")}
                description={job.filtering && !hasExpenseFilters(state) ? t("expenses.explorer.noneOnJobDescription") : t("expenses.explorer.noneMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("expenses.common.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Receipt />}
                title={t("expenses.explorer.noneYet")}
                description={expensesDescription(canManageCategories)}
                action={
                  canCreate ? (
                    <Button
                      onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                      }}
                    >
                      {t("expenses.common.submitExpense")}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(canApprove || canReject) && selectedExpenses.length > 0 && (
            <ExpensesBulkBar
              selected={selectedExpenses}
              onClear={() => setSelected(new Set())}
              onFinished={(title, description) => {
                setSelected(new Set());
                done(title, description);
              }}
            />
          )}
          <ExpensesTable
            expenses={rows}
            now={today}
            me={currentUserId}
            isOwner={isOwner}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={search}
            selection={
              canApprove || canReject
                ? {
                    selected,
                    canSelect: (e) => canReviewThis(e, currentUserId, isOwner),
                    onToggle: (e, on) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (on) next.add(e.id);
                        else next.delete(e.id);
                        return next;
                      }),
                  }
                : undefined
            }
            handlers={handlers}
          />
          {(canApprove || canReject) && !isOwner && (expenses ?? []).some((e) => e.status === "submitted" && e.submittedByUserId === currentUserId) && (
            <p className="text-[13px] text-on-surface-muted">{t("expenses.explorer.ownNote")}</p>
          )}
        </div>
      )}

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing ?? undefined}
        onSaved={(expense, mode) => {
          void load("refresh");
          const label = expenseLabel(expense);
          const amount = formatMoney(BigInt(expense.amount), expense.currency);
          showToast(mode === "created" ? t("expenses.explorer.submitted") : mode === "resubmitted" ? t("expenses.common.expenseResubmitted") : t("expenses.common.expenseUpdated"), mode === "updated" ? t("expenses.common.stillWaiting", { label }) : t("expenses.explorer.waitingWithAmount", { label, amount }));
        }}
      />
      {approving && (
        <ApproveExpenseDialog
          expense={approving}
          open
          onOpenChange={(open) => !open && setApproving(null)}
          onApproved={(updated) => {
            setApproving(null);
            done(t("expenses.common.approvedName", { name: updated.number ?? t("expenses.common.expense") }), t("expenses.common.postedToBooks", { amount: formatMoney(BigInt(updated.amount), updated.currency) }));
          }}
        />
      )}
      {rejecting && (
        <RejectExpenseDialog
          expense={rejecting}
          open
          onOpenChange={(open) => !open && setRejecting(null)}
          onRejected={(updated) => {
            setRejecting(null);
            done(t("expenses.common.expenseRejected"), t("expenses.common.rejectedDescription", { label: expenseLabel(updated), who: updated.submittedByName ?? t("expenses.common.theSubmitter") }));
          }}
        />
      )}
    </div>
  );
}
