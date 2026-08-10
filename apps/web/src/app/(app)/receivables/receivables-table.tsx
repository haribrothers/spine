"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { AGING_BUCKET_LABELS, type AgingBucket, type ReceivablesInvoiceRow } from "./types";

const BUCKET_BADGE_CLASS: Record<AgingBucket, string> = {
  current: "bg-paid-bg text-paid",
  "0-30": "bg-due-soon-bg text-due-soon",
  "31-60": "bg-overdue-bg text-overdue",
  "61-90": "bg-overdue-bg text-overdue",
  "90+": "bg-overdue-bg text-overdue",
};

/** Every currently-outstanding issued invoice, oldest-overdue first (see ReportsService.receivables' own sort) — clicking a row's number navigates to the invoice, same as invoices-table.tsx's own convention. */
export function ReceivablesTable({ invoices }: { invoices: ReceivablesInvoiceRow[] }) {
  const columns: TableColumn<ReceivablesInvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (row) => (
        <Link href={`/invoices/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ?? "Draft"}
        </Link>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"),
      sortValue: (row) => row.dueDate ?? "",
    },
    {
      key: "bucket",
      header: "Aging",
      render: (row) => <Badge className={BUCKET_BADGE_CLASS[row.bucket]}>{AGING_BUCKET_LABELS[row.bucket]}</Badge>,
      sortValue: (row) => row.daysOverdue,
    },
    {
      key: "balanceDue",
      header: "Balance due",
      render: (row) => (
        <span className="font-mono tabular-nums">
          {toDecimalString({ amount: BigInt(row.balanceDue), currency: row.currency })} {row.currency}
        </span>
      ),
      sortValue: (row) => Number(row.balanceDue),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={invoices}
      rowKey={(row) => row.id}
      searchPlaceholder="Search receivables"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""}`}
      configurablePageSize
    />
  );
}
