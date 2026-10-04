"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import Link from "next/link";
import { InvoiceRowActions } from "./invoice-row-actions";
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS, type Invoice } from "./types";
import { formatMoney } from "../../../lib/money";

const STATUS_BADGE_CLASS: Record<Invoice["status"], string> = {
  draft: "bg-draft-bg text-draft",
  issued: "bg-due-soon-bg text-due-soon",
  void: "bg-overdue-bg text-overdue",
};

/**
 * The list view for Invoices — mirrors quotes-table.tsx MINUS the
 * version-grouping logic. Invoices don't have versions/parentQuoteId
 * (that's a quotes-only concept from S-03.x's revision flow); every row
 * here stands alone.
 */
export function InvoicesTable({
  invoices,
  onDeleted,
  onReminderSent,
  onReminderFailed,
}: {
  invoices: Invoice[];
  onDeleted: (invoice: Invoice) => void;
  onReminderSent?: (invoice: Invoice) => void;
  onReminderFailed?: (invoice: Invoice, message: string) => void;
}) {
  const columns: TableColumn<Invoice>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <Link href={`/invoices/${row.id}`} className="flex items-center gap-1.5 font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ? row.number : <span className="italic text-on-surface-muted">— (unissued draft)</span>}
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
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge className={STATUS_BADGE_CLASS[row.status]}>{INVOICE_STATUS_LABELS[row.status]}</Badge>
          {row.type === "advance" && <Badge className="bg-draft-bg text-draft">Deposit</Badge>}
          {row.isOverdue && <Badge className="bg-overdue-bg text-overdue">Overdue</Badge>}
          {PAYMENT_STATUS_LABELS[row.paymentStatus] && (
            <Badge className={row.paymentStatus === "paid" ? "bg-paid-bg text-paid" : "bg-due-soon-bg text-due-soon"}>{PAYMENT_STATUS_LABELS[row.paymentStatus]}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "Due date",
      render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"),
      sortValue: (row) => row.dueDate ?? "",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(BigInt(row.totalAmount), row.currency)}
        </span>
      ),
      sortValue: (row) => Number(row.totalAmount),
    },
    {
      key: "balanceDue",
      header: "Balance due",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(BigInt(row.balanceDue), row.currency)}
        </span>
      ),
      sortValue: (row) => Number(row.balanceDue),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <InvoiceRowActions invoice={row} onDeleted={onDeleted} onReminderSent={onReminderSent} onReminderFailed={onReminderFailed} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={invoices}
      rowKey={(row) => row.id}
      searchPlaceholder="Search invoices"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""}`}
      configurablePageSize
    />
  );
}
