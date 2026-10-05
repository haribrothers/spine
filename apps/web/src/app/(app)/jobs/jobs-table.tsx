"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import Link from "next/link";
import { JOB_STATUS_LABELS, type Job } from "./types";
import { formatMoney } from "../../../lib/money";
import { budgetUsedLabel } from "@spine/shared";
import { AlertTriangle, OctagonAlert } from "lucide-react";

const STATUS_BADGE_CLASS: Record<Job["status"], string> = {
  active: "bg-due-soon-bg text-due-soon",
  on_hold: "bg-draft-bg text-draft",
  completed: "bg-paid-bg text-paid",
  cancelled: "bg-overdue-bg text-overdue",
};

/** The list view for Jobs — mirrors invoices/invoices-table.tsx's own shape. */
export function JobsTable({ jobs }: { jobs: Job[] }) {
  const columns: TableColumn<Job>[] = [
    {
      key: "name",
      header: "Job",
      render: (row) => (
        <Link href={`/jobs/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
          {row.name}
        </Link>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "number",
      header: "Number",
      render: (row) => <span className="tabular-nums text-on-surface-muted">{row.number ?? "—"}</span>,
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{JOB_STATUS_LABELS[row.status]}</Badge>,
    },
  ];
  // Field users get no money fields (US-JOB-19): leave the money columns out for them.
  if (jobs.some((job) => job.contractValueAmount !== undefined)) {
    columns.push(
      {
        key: "contractValue",
        header: "Contract value",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">
            {formatMoney(BigInt(row.contractValueAmount ?? 0), row.currency)}
          </span>
        ),
        sortValue: (row) => Number(row.contractValueAmount ?? 0),
      },
      {
        key: "retentionPct",
        header: "Retention",
        render: (row) => ((row.retentionPct ?? 0) > 0 ? `${row.retentionPct}%` : "—"),
        sortValue: (row) => row.retentionPct ?? 0,
      },
    );
  }
  // US-JOB-25: only present for members with reports.view_job_profitability.
  if (jobs.some((job) => job.budgetState !== undefined)) {
    columns.push({
      key: "budgetUsed",
      header: "Budget used",
      align: "right",
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 tabular-nums ${row.budgetState === "over" ? "text-overdue" : row.budgetState === "near" ? "text-due-soon" : "text-on-surface"}`}
        >
          {row.budgetState === "over" && <OctagonAlert size={13} aria-hidden />}
          {row.budgetState === "near" && <AlertTriangle size={13} aria-hidden />}
          {budgetUsedLabel(row.budgetState, row.budgetUsedPct)}
        </span>
      ),
      sortValue: (row) => row.budgetUsedPct ?? -1,
    });
  }

  return (
    <DataTable
      columns={columns}
      data={jobs}
      rowKey={(row) => row.id}
      searchPlaceholder="Search jobs"
      searchKey={(row) => `${row.number ?? ""} ${row.name} ${row.contactName ?? ""}`}
      configurablePageSize
    />
  );
}
