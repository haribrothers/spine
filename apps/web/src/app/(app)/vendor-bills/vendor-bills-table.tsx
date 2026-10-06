"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import Link from "next/link";
import { VendorBillRowActions } from "./vendor-bill-row-actions";
import { VENDOR_BILL_STATUS_LABELS, type VendorBill } from "./types";
import { formatMoney } from "../../../lib/money";
import { AttachmentCount } from "../../../components/attachments-section";

const STATUS_BADGE_CLASS: Record<VendorBill["status"], string> = {
  draft: "bg-draft-bg text-draft",
  recorded: "bg-due-soon-bg text-due-soon",
  void: "bg-overdue-bg text-overdue",
};

/**
 * The list view for Vendor Bills — mirrors invoices-table.tsx's flat,
 * no-grouping shape. `isOverdue` isn't server-computed for a vendor bill
 * (unlike Invoice.isOverdue, S-05.9) — see use-vendor-bill-stats.ts's own
 * comment — so this table computes it inline per row for the Overdue badge.
 */
export function VendorBillsTable({
  bills,
  onDeleted,
  onRecorded,
}: {
  bills: VendorBill[];
  onDeleted: (bill: VendorBill) => void;
  onRecorded?: (bill: VendorBill) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function isOverdue(bill: VendorBill): boolean {
    return bill.status === "recorded" && bill.dueDate !== null && new Date(bill.dueDate) < today && BigInt(bill.balanceDue) > 0n;
  }

  const columns: TableColumn<VendorBill>[] = [
    {
      key: "billNumber",
      header: "Bill number",
      render: (row) => (
        <span className="flex items-center gap-2">
          <Link href={`/vendor-bills/${row.id}`} className="flex items-center gap-1.5 font-medium text-on-surface hover:text-primary hover:underline">
            {row.billNumber}
          </Link>
          {row.isOpening && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
          <AttachmentCount count={row.attachmentCount} />
        </span>
      ),
      sortValue: (row) => row.billNumber,
    },
    {
      key: "contact",
      header: "Vendor",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge className={STATUS_BADGE_CLASS[row.status]}>{VENDOR_BILL_STATUS_LABELS[row.status]}</Badge>
          {isOverdue(row) && <Badge className="bg-overdue-bg text-overdue">Overdue</Badge>}
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
          <VendorBillRowActions bill={row} onDeleted={onDeleted} onRecorded={onRecorded} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={bills}
      rowKey={(row) => row.id}
      searchPlaceholder="Search vendor bills"
      searchKey={(row) => `${row.billNumber} ${row.contactName ?? ""}`}
      configurablePageSize
    />
  );
}
