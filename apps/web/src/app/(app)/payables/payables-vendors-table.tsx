"use client";

import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { howLate } from "../receivables/receivables-list-state";
import { AgeCell } from "../receivables/receivables-table";
import type { VendorView } from "./payables-list-state";

import { SectionLink } from "../../../components/section-link";
export interface VendorActions {
  onPay: (vendor: VendorView) => void;
  onApplyCredit: (vendor: VendorView) => void;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * US-PUR-56 (D-230) — "By vendor": each vendor we owe, with how many open
 * bills, how late the oldest is, overdue, total owed, credit to use and
 * when we last paid them; a totals row; each row opens onto its bills,
 * oldest due first; a menu to pay them, apply their credit or open the
 * contact.
 */
export function PayablesVendorsTable({
  vendors,
  currency,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  actions,
}: {
  vendors: VendorView[];
  currency: string;
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  actions: VendorActions;
}) {
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const sum = (pick: (v: VendorView) => string) => vendors.reduce((s, v) => s + BigInt(pick(v)), 0n);
  const columns: TableColumn<VendorView>[] = [
    {
      key: "name",
      header: "Vendor",
      render: (v) => (
        <SectionLink href={`/contacts/${v.contactId}`} className="block max-w-72 truncate font-semibold text-on-surface hover:text-primary hover:underline" title={v.name ?? undefined}>
          {v.name ?? "Vendor"}
        </SectionLink>
      ),
      sortValue: (v) => v.name ?? "",
    },
    { key: "count", header: "Open", render: (v) => plural(v.billCount, "bill"), sortValue: (v) => v.billCount },
    {
      key: "oldest",
      header: "Oldest",
      render: (v) => <span className={v.oldestDaysOverdue > 0 ? "font-medium text-overdue" : "text-on-surface-muted"}>{howLate({ dueDate: v.oldestDueDate, daysOverdue: v.oldestDaysOverdue })}</span>,
      sortValue: (v) => (v.oldestDueDate ? v.oldestDaysOverdue : Number.NEGATIVE_INFINITY),
    },
    {
      key: "overdue",
      header: "Overdue",
      align: "right",
      render: (v) => (BigInt(v.overdueAmount) > 0n ? <span className="font-semibold tabular-nums text-overdue">{money(v.overdueAmount)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (v) => BigInt(v.overdueAmount),
    },
    { key: "total", header: "Total owed", align: "right", render: (v) => <span className="tabular-nums">{money(v.totalOutstanding)}</span>, sortValue: (v) => BigInt(v.totalOutstanding) },
    {
      key: "credit",
      header: "Credit to use",
      align: "right",
      render: (v) => (BigInt(v.credit) > 0n ? <span className="font-semibold tabular-nums text-due-soon">{money(v.credit)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (v) => BigInt(v.credit),
    },
    {
      key: "lastPaid",
      header: "Last paid",
      render: (v) => (v.lastPaidOn ? <span className="whitespace-nowrap">{calendarDate(v.lastPaidOn, now, locale)}</span> : <span className="text-on-surface-muted">Never</span>),
      sortValue: (v) => v.lastPaidOn ?? "",
    },
    {
      key: "actions",
      header: "",
      render: (v) => (
        <div className="flex justify-end">
          <VendorRowMenu vendor={v} actions={actions} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={vendors}
      rowKey={(v) => v.contactId}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      footer={{
        name: plural(vendors.length, "vendor"),
        count: plural(vendors.reduce((s, v) => s + v.billCount, 0), "bill"),
        overdue: money(sum((v) => v.overdueAmount)),
        total: money(sum((v) => v.totalOutstanding)),
        credit: money(sum((v) => v.credit)),
      }}
      renderExpanded={(v) => <VendorBills vendor={v} now={now} />}
      expandLabel={(v, open) => `${open ? "Hide" : "Show"} ${v.name ?? "the vendor"}'s bills`}
    />
  );
}

/** A vendor's open bills under their row, oldest due first. */
function VendorBills({ vendor, now }: { vendor: VendorView; now: Date }) {
  const locale = orgLocaleTag();
  return (
    <ul className="flex flex-col py-1.5 pl-12 pr-14" aria-label={`${vendor.name ?? "The vendor"}'s open bills`} data-testid="vendor-bills">
      {vendor.bills.map((row) => (
        <li key={row.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-3 py-1.5 text-[13px]">
          <span className="truncate">
            <SectionLink href={`/vendor-bills/${row.id}`} className="font-medium text-primary hover:underline">
              {row.billNumber}
            </SectionLink>
            {row.jobName && <span className="text-on-surface-muted"> · {row.jobName}</span>}
          </span>
          <span className="whitespace-nowrap text-on-surface-muted">
            Due <span className="text-on-surface">{row.dueDate ? calendarDate(row.dueDate, now, locale) : "—"}</span>
          </span>
          <AgeCell row={row} />
          <span className="text-right tabular-nums">{formatMoney(BigInt(row.balanceDue), row.currency)}</span>
        </li>
      ))}
    </ul>
  );
}

/** US-PUR-58 — Pay vendor, Apply credit (while they have credit) and Open contact, each with its right. */
function VendorRowMenu({ vendor, actions }: { vendor: VendorView; actions: VendorActions }) {
  const router = useRouter();
  const canPay = useCapability("vendor_payments.edit_own");
  const canApply = useCapability("vendor_credits.apply");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${vendor.name ?? "this vendor"}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPay && (
          <DropdownMenuItem onSelect={() => actions.onPay(vendor)}>
            <MENU_ICONS.recordPayment aria-hidden />
            Pay vendor
          </DropdownMenuItem>
        )}
        {canApply && BigInt(vendor.credit) > 0n && (
          <DropdownMenuItem onSelect={() => actions.onApplyCredit(vendor)}>
            <MENU_ICONS.applyCredit aria-hidden />
            Apply credit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(`/contacts/${vendor.contactId}`)}>
          <MENU_ICONS.contact aria-hidden />
          Open contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
