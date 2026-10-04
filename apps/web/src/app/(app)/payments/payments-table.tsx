"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { PAYMENT_METHOD_LABELS, type Payment } from "./types";
import { formatMoney } from "../../../lib/money";

/**
 * The list view for Payments — mirrors invoices-table.tsx's flat, no-
 * grouping shape (a payment has no versions or parent, same as an
 * invoice). Clicking the Number cell opens `PaymentDetailDrawer` rather
 * than navigating to its own route, since a payment is a much smaller
 * record than an invoice/quote (no line items) — matching Catalogue's own
 * drawer-not-page precedent (clickable cell, not a table-level row-click
 * prop — `DataTable` doesn't have one).
 */
export function PaymentsTable({ payments, onOpen }: { payments: Payment[]; onOpen: (payment: Payment) => void }) {
  const columns: TableColumn<Payment>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <button type="button" onClick={() => onOpen(row)} className="text-left font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ?? <span className="italic text-on-surface-muted">—</span>}
        </button>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => new Date(row.date).toLocaleDateString(),
      sortValue: (row) => row.date,
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "method",
      header: "Method",
      render: (row) => PAYMENT_METHOD_LABELS[row.method],
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
      key: "unallocated",
      header: "Unallocated",
      align: "right",
      render: (row) =>
        row.unallocatedAmount === "0" ? (
          <Badge className="bg-paid-bg text-paid">Fully allocated</Badge>
        ) : (
          <span className="tabular-nums text-due-soon">
            {formatMoney(BigInt(row.unallocatedAmount), row.currency)}
          </span>
        ),
      sortValue: (row) => Number(row.unallocatedAmount),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={payments}
      rowKey={(row) => row.id}
      searchPlaceholder="Search payments"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""} ${row.reference ?? ""}`}
      configurablePageSize
    />
  );
}
