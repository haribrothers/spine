"use client";

import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { AgeCell } from "../receivables/receivables-table";
import type { PayablesBillRow } from "./types";

import { SectionLink } from "../../../components/section-link";
export interface BillActions {
  onPay: (row: PayablesBillRow) => void;
  onApplyCredit: (row: PayablesBillRow) => void;
  /** Whether the vendor has credit to apply. */
  hasCredit: (contactId: string) => boolean;
}

/**
 * US-PUR-57/US-PUR-58 (D-230) — "By bill": the number with the job under
 * it, the vendor, the due date in the business's format, the coloured age
 * with how late in words, and the balance; Bill date, Bill total and Paid
 * so far in Columns. Rows can be ticked for Pay (n), and each has a menu.
 */
export function PayablesBillsTable({
  bills,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  selected,
  onSelectedChange,
  actions,
}: {
  bills: PayablesBillRow[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  actions: BillActions;
}) {
  const locale = orgLocaleTag();
  const date = (iso: string | null) => (iso ? calendarDate(iso, now, locale) : "—");
  const money = (row: PayablesBillRow, v: string) => <span className="tabular-nums">{formatMoney(BigInt(v), row.currency)}</span>;
  const columns: TableColumn<PayablesBillRow>[] = [
    {
      key: "billNumber",
      header: "Bill",
      render: (row) => (
        <div className="flex max-w-[14rem] flex-col">
          <SectionLink href={`/vendor-bills/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
            {row.billNumber}
          </SectionLink>
          {row.jobName && <span className="truncate text-[12px] text-on-surface-muted">{row.jobName}</span>}
        </div>
      ),
      sortValue: (row) => row.billNumber,
    },
    {
      key: "contact",
      header: "Vendor",
      render: (row) => (
        <SectionLink href={`/contacts/${row.contactId}`} className="block max-w-56 truncate text-on-surface hover:text-primary hover:underline" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </SectionLink>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    { key: "dueDate", header: "Due", render: (row) => <span className="whitespace-nowrap">{date(row.dueDate)}</span>, sortValue: (row) => row.dueDate ?? "" },
    { key: "late", header: "How late", render: (row) => <AgeCell row={row} />, sortValue: (row) => row.daysOverdue },
    { key: "date", header: "Bill date", render: (row) => <span className="whitespace-nowrap">{date(row.date)}</span>, sortValue: (row) => row.date },
    { key: "totalAmount", header: "Bill total", align: "right", render: (row) => money(row, row.totalAmount), sortValue: (row) => BigInt(row.totalAmount) },
    { key: "paidAmount", header: "Paid so far", align: "right", render: (row) => money(row, row.paidAmount), sortValue: (row) => BigInt(row.paidAmount) },
    { key: "balanceDue", header: "Balance due", align: "right", render: (row) => money(row, row.balanceDue), sortValue: (row) => BigInt(row.balanceDue) },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <BillRowMenu row={row} actions={actions} />
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
      defaultHidden={["date", "totalAmount", "paidAmount"]}
    />
  );
}

/** US-PUR-58 — Pay bill, Apply credit (while the vendor has credit) and Open bill, each with its right. */
function BillRowMenu({ row, actions }: { row: PayablesBillRow; actions: BillActions }) {
  const router = useRouter();
  const canPay = useCapability("vendor_payments.edit_own");
  const canApply = useCapability("vendor_credits.apply");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${row.billNumber}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {canPay && (
          <DropdownMenuItem onSelect={() => actions.onPay(row)}>
            <MENU_ICONS.recordPayment aria-hidden />
            Pay bill
          </DropdownMenuItem>
        )}
        {canApply && actions.hasCredit(row.contactId) && (
          <DropdownMenuItem onSelect={() => actions.onApplyCredit(row)}>
            <MENU_ICONS.applyCredit aria-hidden />
            Apply credit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(`/vendor-bills/${row.id}`)}>
          <MENU_ICONS.open aria-hidden />
          Open bill
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
