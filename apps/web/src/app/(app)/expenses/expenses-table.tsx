"use client";

import { Badge, Checkbox, DataTable, type TableColumn } from "@spine/ui";
import type { MemberRow } from "../../../lib/members";
import { ExpenseRowActions } from "./expense-row-actions";
import { EXPENSE_STATUS_LABELS, type Expense, type JobOption } from "./types";
import { formatMoney } from "../../../lib/money";

const STATUS_BADGE_CLASS: Record<Expense["status"], string> = {
  submitted: "bg-draft-bg text-draft",
  approved: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * The list view for Expenses — a single amount per row, not a multi-line
 * document, so there's no "number" column the way invoices/vendor bills
 * have (an expense's `number` is null until approved — S-07.4's posting
 * trigger allocates it then). Clicking a row's date/category opens
 * `ExpenseDetailDrawer` rather than navigating to its own route, mirroring
 * payments-table.tsx's own drawer-not-page precedent (an expense is a
 * small record, no line items).
 */
export function ExpensesTable({
  expenses,
  jobs,
  members,
  onDeleted,
  onOpen,
  selection,
}: {
  expenses: Expense[];
  /** US-PUR-21 — ticked rows for bulk approval; no tick boxes when absent. */
  selection?: { selected: Set<string>; canSelect: (expense: Expense) => boolean; onToggle: (expense: Expense, on: boolean) => void };
  jobs: JobOption[];
  members: MemberRow[];
  onDeleted: (expense: Expense) => void;
  onOpen: (expense: Expense) => void;
}) {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const memberByUserId = new Map(members.map((m) => [m.userId, m]));

  const columns: TableColumn<Expense>[] = [
    ...(selection
      ? [
          {
            key: "select",
            header: "",
            render: (row: Expense) => (
              <Checkbox
                checked={selection.selected.has(row.id)}
                disabled={!selection.canSelect(row)}
                onCheckedChange={(v) => selection.onToggle(row, v === true)}
                aria-label={`Select ${row.categoryName ?? "expense"} ${formatMoney(BigInt(row.amount), row.currency)}`}
              />
            ),
          },
        ]
      : []),
    {
      key: "date",
      header: "Date",
      render: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="text-left font-medium text-on-surface hover:text-primary hover:underline"
        >
          {new Date(row.date).toLocaleDateString()}
        </button>
      ),
      sortValue: (row) => row.date,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.categoryName ?? "—",
      sortValue: (row) => row.categoryName ?? "",
    },
    {
      key: "job",
      header: "Job",
      render: (row) => (row.jobId ? (jobById.get(row.jobId)?.name ?? "—") : "—"),
      sortValue: (row) => (row.jobId ? (jobById.get(row.jobId)?.name ?? "") : ""),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(BigInt(row.amount), row.currency)}
        </span>
      ),
      sortValue: (row) => Number(row.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge className={STATUS_BADGE_CLASS[row.status]}>{EXPENSE_STATUS_LABELS[row.status]}</Badge>
          {row.isBillable && <Badge className="bg-due-soon-bg text-due-soon">Billable</Badge>}
        </div>
      ),
    },
    {
      key: "submittedBy",
      header: "Submitted by",
      render: (row) => (row.submittedByUserId ? (memberByUserId.get(row.submittedByUserId)?.name ?? "—") : "—"),
      sortValue: (row) => (row.submittedByUserId ? (memberByUserId.get(row.submittedByUserId)?.name ?? "") : ""),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <ExpenseRowActions expense={row} onDeleted={onDeleted} onOpen={onOpen} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={expenses}
      rowKey={(row) => row.id}
      searchPlaceholder="Search expenses"
      searchKey={(row) => `${row.categoryName ?? ""} ${row.description ?? ""}`}
      configurablePageSize
    />
  );
}
