"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, EmptyState, MultiSelect, StatCard, Switch } from "@spine/ui";
import { Receipt } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import type { MemberRow } from "../../../lib/members";
import { useEntityToast } from "./entity-toast";
import { ExpenseDetailDrawer } from "./expense-detail-drawer";
import { ExpenseForm } from "./expense-form";
import { ExpensesSkeleton } from "./expenses-skeleton";
import { ExpensesTable } from "./expenses-table";
import { ExpensesBulkBar } from "./expenses-bulk-bar";
import { useMyRole } from "../../../lib/role-context";
import { JobFilter, JobFilterNote, useJobFilter } from "../../../components/job-filter";
import { expensesDescription, useCanManageExpenseCategories } from "./expenses-header";
import type { Expense, JobOption } from "./types";
import { useExpenseStats } from "./use-expense-stats";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/**
 * The Expenses list page's client-side body — a stat-card row, a status
 * filter, a "mine" toggle (`GET /expenses?mine=true`, relevant for a Field/
 * Staff user who only wants to see what they personally submitted — every
 * role can reach this page per ExpensesController's own doc comment, this
 * toggle just narrows the list), and one table. Mirrors
 * vendor-bills/vendor-bills-explorer.tsx's structure, minus a contact
 * filter (an expense has no contact) plus the `mine` toggle instead.
 *
 * `canApprove`/`canReject` gate Approve/Reject in the detail drawer, backed
 * by the real `expenses.approve`/`expenses.reject` capabilities (see
 * capabilities-context.tsx) — these replace an earlier coarse role check
 * (owner/staff) that predates the own/others capability split.
 */
export function ExpensesExplorer({ currentUserId }: { currentUserId: string | null }) {
  const canApprove = useCapability("expenses.approve");
  const canReject = useCapability("expenses.reject");
  const canCreate = useCapability("expenses.edit_own");
  const canManageCategories = useCanManageExpenseCategories();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // US-DASH-13: "Review" on the dashboard opens ?status=submitted.
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string[]>(() => searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  // US-DASH-18: the dashboard links here with ?mine=true, ?id=<expense> (open it) or ?new=1 (the submit form).
  const [mineOnly, setMineOnly] = useState(() => searchParams.get("mine") === "true");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [formOpen, setFormOpen] = useState(() => searchParams.get("new") === "1");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(() => searchParams.get("id"));
  // US-PUR-10 — the form edits this expense when set, else submits a new one.
  const [editing, setEditing] = useState<Expense | null>(null);
  function openNewExpense() {
    setEditing(null);
    setFormOpen(true);
  }
  const { show: showToast, toast } = useEntityToast();
  // US-PUR-21 — bulk approval. Staff can't review their own expenses (D-085); Owners can.
  const role = useMyRole();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const canSelect = useCallback((e: Expense) => e.status === "submitted" && (role === "owner" || e.submittedByUserId !== currentUserId), [role, currentUserId]);
  const selectedExpenses = useMemo(() => (expenses ?? []).filter((e) => selectedIds.has(e.id) && canSelect(e)), [expenses, selectedIds, canSelect]);
  const hasOwnSubmitted = role !== "owner" && (expenses ?? []).some((e) => e.status === "submitted" && e.submittedByUserId === currentUserId);

  // US-PUR-22 — filter by job, kept in the URL.
  const job = useJobFilter();
  const canViewCosting = useCapability("reports.view_job_profitability");
  const stats = useExpenseStats(expenses);

  const loadExpenses = useCallback(() => {
    const params = new URLSearchParams();
    if (mineOnly) params.set("mine", "true");
    if (job.filtering) params.set("jobId", job.jobId);
    const query = params.toString() ? `?${params}` : "";
    apiClient
      .get<Expense[]>(`/expenses${query}`)
      .then(setExpenses)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load expenses."));
  }, [mineOnly, job.filtering, job.jobId]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    apiClient.get<JobOption[]>("/jobs").then(setJobs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    apiClient
      .get<MemberRow[]>("/org/members")
      .then(setMembers)
      .catch(() => {});
  }, [currentUserId]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return null;
    if (!statusFilter.length) return expenses;
    return expenses.filter((e) => statusFilter.includes(e.status));
  }, [expenses, statusFilter]);

  function handleSaved(expense: Expense, mode: "created" | "updated") {
    loadExpenses();
    showToast(mode === "created" ? "Expense submitted" : "Expense updated", `${expense.categoryName ?? "The expense"} has been saved.`);
  }

  function handleDeleted(expense: Expense) {
    loadExpenses();
    showToast("Expense deleted", `${expense.categoryName ?? "This expense"} has been permanently removed.`);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total expenses" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Submitted" value={stats.submitted === null ? "—" : String(stats.submitted)} />
        <StatCard label="Approved" value={stats.approved === null ? "—" : String(stats.approved)} />
        <StatCard label="Rejected" value={stats.rejected === null ? "—" : String(stats.rejected)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            aria-label="Filter by status"
            className="w-40"
          />
          <JobFilter value={job.jobId} options={job.options} onValueChange={job.setJobId} />
          <label className="flex items-center gap-2 text-[13px] text-on-surface">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} />
            My expenses only
          </label>
        </div>
        {canCreate && <Button onClick={() => openNewExpense()}>Submit expense</Button>}
      </div>

      {selectedExpenses.length > 0 && (
        <ExpensesBulkBar
          selected={selectedExpenses}
          onClear={() => setSelectedIds(new Set())}
          onFinished={(title, description) => {
            setSelectedIds(new Set());
            loadExpenses();
            showToast(title, description);
          }}
        />
      )}

      {job.filtering && job.selectedLabel && <JobFilterNote kind="expenses" jobId={job.jobId} label={job.selectedLabel} canViewCosting={canViewCosting} />}

      {!filteredExpenses ? (
        <ExpensesSkeleton />
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          {job.filtering && !statusFilter.length && !mineOnly ? (
            <EmptyState
              icon={<Receipt />}
              title="No expenses on this job"
              description="Expenses tagged to this job show up here."
              action={
                <Button variant="secondary" onClick={() => job.setJobId("__all__")}>
                  Clear filter
                </Button>
              }
            />
          ) : statusFilter.length || mineOnly || job.filtering ? (
            <EmptyState
              icon={<Receipt />}
              title="No expenses match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter([]);
                    setMineOnly(false);
                    job.setJobId("__all__");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Receipt />}
              title="No expenses yet"
              description={expensesDescription(canManageCategories)}
              action={canCreate ? <Button onClick={() => openNewExpense()}>Submit expense</Button> : undefined}
            />
          )}
        </div>
      ) : (
        <ExpensesTable
          expenses={filteredExpenses}
          jobs={jobs}
          members={members}
          onDeleted={handleDeleted}
          onOpen={(expense) => setSelectedExpenseId(expense.id)}
          onEdit={(expense) => {
            setEditing(expense);
            setFormOpen(true);
          }}
          selection={
            canApprove
              ? {
                  selected: selectedIds,
                  canSelect,
                  onToggle: (expense, on) =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (on) next.add(expense.id);
                      else next.delete(expense.id);
                      return next;
                    }),
                }
              : undefined
          }
        />
      )}
      {canApprove && hasOwnSubmitted && <p className="text-[13px] text-on-surface-muted">Your own expenses can&apos;t be selected for approval — someone else approves them.</p>}

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} expense={editing ?? undefined} onSaved={handleSaved} />
      <ExpenseDetailDrawer
        open={selectedExpenseId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpenseId(null);
        }}
        expenseId={selectedExpenseId}
        canApprove={canApprove}
        canReject={canReject}
        onChanged={loadExpenses}
        onDeleted={handleDeleted}
      />
      {toast}
    </div>
  );
}
