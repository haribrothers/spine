"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { JOB_STATUS_LABELS, type Job } from "./types";

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
        render: (row) => (
          <span className="font-mono tabular-nums">
            {toDecimalString({ amount: BigInt(row.contractValueAmount ?? 0), currency: row.currency })} {row.currency}
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
