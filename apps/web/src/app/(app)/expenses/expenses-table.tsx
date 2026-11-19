"use client";

import Link from "next/link";
import { Badge, Checkbox, DataTable, type TableColumn, type TableSort } from "@spine/ui";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { AttachmentCount } from "../../../components/attachments-section";
import { calendarDate } from "../quotes/quotes-list-state";
import { ExpenseRowActions, type ExpenseRowHandlers } from "./expense-row-actions";
import { EXPENSE_STATES, EXPENSE_STATE_CLASS, EXPENSE_STATE_LABELS, expenseState, readyToBill } from "./expense-state";
import type { Expense } from "./types";
import { useT } from "../../../lib/i18n";

/**
 * US-PUR-42 (D-227) — the expenses list: the date (opening the expense),
 * the number once approved, the description over its category, the job,
 * who submitted it and who paid, the state in words (with Billable when
 * it's ready to bill), and the amount, with a row menu. Approvers can tick
 * rows to approve or reject together (US-PUR-21).
 */
export function ExpensesTable({
  expenses,
  now,
  me,
  isOwner,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  selection,
  handlers,
}: {
  expenses: Expense[];
  now: Date;
  me: string | null;
  isOwner: boolean;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  /** US-PUR-21 — tick boxes for approvers; a box is disabled on an expense I can't review (my own, unless I'm an Owner, or already reviewed). */
  selection?: { selected: ReadonlySet<string>; canSelect: (expense: Expense) => boolean; onToggle: (expense: Expense, on: boolean) => void };
  handlers: ExpenseRowHandlers;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const muted = <span className="text-on-surface-muted">—</span>;
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
                aria-label={t("expenses.table.selectAria", { name: row.categoryName ?? t("expenses.table.expenseLower"), amount: formatMoney(BigInt(row.amount), row.currency) })}
              />
            ),
          },
        ]
      : []),
    {
      key: "date",
      phone: "trailingSub",
      phoneRender: (row) => calendarDate(row.date.slice(0, 10), now, locale),
      header: t("expenses.columns.date"),
      render: (row) => (
        <Link href={`/expenses/${row.id}`} className="whitespace-nowrap font-medium text-on-surface hover:text-primary hover:underline">
          {calendarDate(row.date.slice(0, 10), now, locale)}
        </Link>
      ),
      sortValue: (row) => `${row.date.slice(0, 10)}${row.createdAt}`,
    },
    { key: "number", phone: "hidden", header: t("expenses.columns.number"), render: (row) => (row.number ? <span className="font-semibold">{row.number}</span> : muted), sortValue: (row) => row.number ?? "" },
    {
      key: "description",
      // US-OPS-56: on a phone, what it was on one line; its number, category and job go on the second.
      phone: "title",
      phoneRender: (row) => <Link href={`/expenses/${row.id}`}>{row.description || row.categoryName || t("expenses.common.expense")}</Link>,
      header: t("expenses.columns.description"),
      render: (row) => (
        <Link href={`/expenses/${row.id}`} className="flex min-w-0 max-w-72 flex-col hover:text-primary">
          <span className="flex items-center gap-2 truncate font-medium text-on-surface">
            <span className="truncate">{row.description || row.categoryName || t("expenses.common.expense")}</span>
            <AttachmentCount count={row.attachmentCount} />
          </span>
          <span className="truncate text-[12px] text-on-surface-muted">{row.entryMode === "labour" ? t("expenses.table.labourLine", { category: row.categoryName ?? t("expenses.labour.fallbackCategory") }) : (row.categoryName ?? "")}</span>
        </Link>
      ),
      sortValue: (row) => row.description ?? row.categoryName ?? "",
    },
    {
      key: "job",
      phone: "subtitle",
      phoneRender: (row) => [row.number, row.description ? row.categoryName : null, row.jobName].filter(Boolean).join(" · ") || null,
      header: t("expenses.columns.job"),
      render: (row) => (row.jobId ? <span className="block max-w-44 truncate" title={row.jobName ?? undefined}>{row.jobName ?? "—"}</span> : muted),
      sortValue: (row) => row.jobName ?? "",
    },
    { key: "submittedBy", phone: "hidden", header: t("expenses.columns.submittedBy"), render: (row) => (row.submittedByUserId === me ? t("expenses.table.you") : (row.submittedByName ?? "—")), sortValue: (row) => row.submittedByName ?? "" },
    { key: "paidBy", phone: "hidden", header: t("expenses.columns.paidBy"), render: (row) => (row.paidBy === "employee" ? t("expenses.table.employee") : t("expenses.table.company")), sortValue: (row) => row.paidBy },
    {
      key: "state",
      phone: "badge",
      phoneRender: (row) => {
        const state = expenseState(row);
        return (
          <>
            <Badge className={EXPENSE_STATE_CLASS[state]} data-testid="expense-row-state">
              {EXPENSE_STATE_LABELS[state]}
            </Badge>
            {readyToBill(row) && <Badge className="border border-border bg-transparent text-on-surface-muted">{t("expenses.common.billable")}</Badge>}
          </>
        );
      },
      header: t("expenses.columns.state"),
      render: (row) => {
        const state = expenseState(row);
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge className={EXPENSE_STATE_CLASS[state]} data-testid="expense-row-state">
              {EXPENSE_STATE_LABELS[state]}
            </Badge>
            {readyToBill(row) && <Badge className="border border-border bg-transparent text-on-surface-muted">{t("expenses.common.billable")}</Badge>}
          </span>
        );
      },
      sortValue: (row) => EXPENSE_STATES.indexOf(expenseState(row)),
    },
    { key: "amount", phone: "trailing", header: t("expenses.columns.amount"), align: "right", render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.amount), row.currency)}</span>, sortValue: (row) => BigInt(row.amount) },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <ExpenseRowActions expense={row} me={me} isOwner={isOwner} handlers={handlers} />
        </div>
      ),
    },
  ];

  return (
    <div data-testid="expenses-table">
      <DataTable
        columns={columns}
        data={expenses}
        rowKey={(row) => row.id}
        configurablePageSize
        toolbarStart={toolbarStart}
        sort={sort}
        onSortChange={onSortChange}
        page={page}
        onPageChange={onPageChange}
      />
    </div>
  );
}
