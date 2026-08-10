"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, EmptyState, MultiSelect, StatCard, Switch } from "@spine/ui";
import { Receipt } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import type { MemberRow } from "../../../lib/members";
import { useEntityToast } from "./entity-toast";
import { ExpenseDetailDrawer } from "./expense-detail-drawer";
import { ExpenseForm } from "./expense-form";
import { ExpensesSkeleton } from "./expenses-skeleton";
import { ExpensesTable } from "./expenses-table";
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
 * `canApprove` is passed down to gate Approve/Reject in the detail drawer —
 * resolved the same coarse `GET /org/members` + role check
 * jobs/job-detail.tsx already established (no client-side capability check
 * finer than role exists in this codebase yet); hiding the buttons here is
 * UI signal only, the server independently 403s regardless.
 */
export function ExpensesExplorer({ currentUserId }: { currentUserId: string | null }) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const { show: showToast, toast } = useEntityToast();

  const stats = useExpenseStats(expenses);

  const loadExpenses = useCallback(() => {
    const query = mineOnly ? "?mine=true" : "";
    apiClient
      .get<Expense[]>(`/expenses${query}`)
      .then(setExpenses)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load expenses."));
  }, [mineOnly]);

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
      .then((rows) => {
        setMembers(rows);
        const self = rows.find((m) => m.userId === currentUserId);
        setCanApprove(self?.role === "owner" || self?.role === "staff");
      })
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
            className="w-40"
          />
          <label className="flex items-center gap-2 text-[13px] text-on-surface">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} />
            My expenses only
          </label>
        </div>
        <Button onClick={() => setFormOpen(true)}>Submit expense</Button>
      </div>

      {!filteredExpenses ? (
        <ExpensesSkeleton />
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length || mineOnly ? (
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
              description="Submit an expense — categories are managed from Settings → Purchases."
              action={<Button onClick={() => setFormOpen(true)}>Submit expense</Button>}
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
        />
      )}

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} onSaved={handleSaved} />
      <ExpenseDetailDrawer
        open={selectedExpenseId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpenseId(null);
        }}
        expenseId={selectedExpenseId}
        canApprove={canApprove}
        onChanged={loadExpenses}
        onDeleted={handleDeleted}
      />
      {toast}
    </div>
  );
}
