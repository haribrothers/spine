"use client";

import { DataTable, type TableColumn } from "@spine/ui";
import { PAYMENT_METHOD_LABELS, type VendorPayment } from "./types";
import { formatMoney } from "../../../lib/money";

/**
 * The list view for Vendor Payments — mirrors payments/payments-table.tsx's
 * flat, no-grouping, no-status shape, minus the "Unallocated" column (a
 * vendor payment always allocates its full amount at creation — see
 * createVendorPaymentSchema's own doc comment, there's no partial/
 * unallocated-as-credit concept on this side). Clicking the Number cell
 * opens `VendorPaymentDetailDrawer` rather than navigating to its own
 * route, same reasoning as payments-table.tsx.
 */
export function VendorPaymentsTable({ payments, onOpen }: { payments: VendorPayment[]; onOpen: (payment: VendorPayment) => void }) {
  const columns: TableColumn<VendorPayment>[] = [
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
      header: "Vendor",
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
  ];

  return (
    <DataTable
      columns={columns}
      data={payments}
      rowKey={(row) => row.id}
      searchPlaceholder="Search vendor payments"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""} ${row.reference ?? ""}`}
      configurablePageSize
    />
  );
}
