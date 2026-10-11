"use client";

import Link from "next/link";
import { Badge, DataTable, cn, type TableColumn, type TableSort } from "@spine/ui";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { AttachmentCount } from "../../../components/attachments-section";
import { calendarDate } from "../quotes/quotes-list-state";
import { VendorBillRowActions, type BillRowHandlers } from "./vendor-bill-row-actions";
import { BILL_STATE_CLASS, BILL_STATE_LABELS, BILL_STATES, billState, daysLate, lateLabel } from "./vendor-bill-state";
import type { VendorBill } from "./types";

/**
 * US-PUR-34 (D-225) — the bills list: the bill number, the vendor (opening
 * the contact), the bill date, the due date with how late in words, the
 * job, the state in words, the total and the balance ("—" for a void
 * bill), with a row menu. Drafts can be ticked to record together.
 */
export function VendorBillsTable({
  bills,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  selected,
  onSelectedChange,
  handlers,
}: {
  bills: VendorBill[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  handlers: BillRowHandlers;
}) {
  const locale = orgLocaleTag();
  const date = (iso: string | null) => (iso ? calendarDate(iso.slice(0, 10), now, locale) : "—");
  const columns: TableColumn<VendorBill>[] = [
    {
      key: "billNumber",
      header: "Bill",
      render: (row) => (
        <span className="flex items-center gap-2">
          <Link href={`/vendor-bills/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
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
      render: (row) => (
        <Link href={`/contacts/${row.contactId}`} className="block max-w-56 truncate text-on-surface hover:text-primary hover:underline" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </Link>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    { key: "date", header: "Bill date", render: (row) => <span className="whitespace-nowrap">{date(row.date)}</span>, sortValue: (row) => `${row.date.slice(0, 10)}${row.createdAt}` },
    {
      key: "dueDate",
      header: "Due",
      render: (row) => {
        const late = lateLabel(row, now);
        const over = (daysLate(row.dueDate, now) ?? 0) > 0;
        return (
          <div className="flex flex-col whitespace-nowrap">
            <span>{date(row.dueDate)}</span>
            {late && <span className={cn("text-[12px]", over ? "font-medium text-overdue" : "text-on-surface-muted")}>{late}</span>}
          </div>
        );
      },
      sortValue: (row) => row.dueDate ?? "",
    },
    {
      key: "job",
      header: "Job",
      render: (row) => (row.jobId ? <span className="block max-w-44 truncate" title={row.jobName ?? undefined}>{row.jobName ?? "—"}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (row) => row.jobName ?? "",
    },
    {
      key: "state",
      header: "State",
      render: (row) => {
        const state = billState(row, now);
        return (
          <Badge className={BILL_STATE_CLASS[state]} data-testid="bill-row-state">
            {BILL_STATE_LABELS[state]}
          </Badge>
        );
      },
      sortValue: (row) => BILL_STATES.indexOf(billState(row, now)),
    },
    { key: "total", header: "Total", align: "right", render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>, sortValue: (row) => BigInt(row.totalAmount) },
    {
      key: "balanceDue",
      header: "Balance",
      align: "right",
      render: (row) => (row.status === "void" ? <span className="text-on-surface-muted">—</span> : <span className="tabular-nums">{formatMoney(BigInt(row.balanceDue), row.currency)}</span>),
      sortValue: (row) => (row.status === "void" ? -1n : BigInt(row.balanceDue)),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <VendorBillRowActions bill={row} handlers={handlers} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={bills}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={(row) => row.billNumber}
    />
  );
}
