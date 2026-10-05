"use client";

import { Badge, Checkbox, DataTable, type TableColumn } from "@spine/ui";
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
  selected,
  onToggleSelected,
}: {
  invoices: Invoice[];
  /** US-INV-23 — ticked rows, for the bulk bar. */
  selected?: Set<string>;
  onToggleSelected?: (invoice: Invoice, selected: boolean) => void;
  onDeleted: (invoice: Invoice) => void;
  onReminderSent?: (invoice: Invoice) => void;
  onReminderFailed?: (invoice: Invoice, message: string) => void;
}) {
  const columns: TableColumn<Invoice>[] = [
    ...(selected && onToggleSelected
      ? [
          {
            key: "select",
            header: "",
            render: (row: Invoice) => (
              <Checkbox
                checked={selected.has(row.id)}
                onCheckedChange={(v) => onToggleSelected(row, v === true)}
                aria-label={`Select ${row.number ?? "draft invoice"}`}
              />
            ),
          },
        ]
      : []),
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
      // US-OPS-21: a void invoice owes nothing, so it shows "—", not its old total.
      render: (row) =>
        row.status === "void" ? (
          <span className="text-on-surface-muted">—</span>
        ) : (
          <span className="tabular-nums">{formatMoney(BigInt(row.balanceDue), row.currency)}</span>
        ),
      sortValue: (row) => (row.status === "void" ? 0 : Number(row.balanceDue)),
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
