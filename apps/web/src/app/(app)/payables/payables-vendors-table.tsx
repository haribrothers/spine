"use client";

import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { useT } from "../../../lib/i18n";
import { calendarDate } from "../quotes/quotes-list-state";
import { howLate } from "../receivables/receivables-list-state";
import { AgeCell } from "../receivables/receivables-table";
import type { VendorView } from "./payables-list-state";

import { SectionLink } from "../../../components/section-link";
export interface VendorActions {
  onPay: (vendor: VendorView) => void;
  onApplyCredit: (vendor: VendorView) => void;
}

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
  const t = useT();
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const sum = (pick: (v: VendorView) => string) => vendors.reduce((s, v) => s + BigInt(pick(v)), 0n);
  const columns: TableColumn<VendorView>[] = [
    {
      key: "name",
      header: t("payables.columns.vendor"),
      render: (v) => (
        <SectionLink href={`/contacts/${v.contactId}`} className="block max-w-72 truncate font-semibold text-on-surface hover:text-primary hover:underline" title={v.name ?? undefined}>
          {v.name ?? t("payables.vendorsTable.vendorFallback")}
        </SectionLink>
      ),
      // US-OPS-56: on a phone, the name; how many bills and when they were last paid go on the second line.
      phone: "title",
      phoneRender: (v) => <SectionLink href={`/contacts/${v.contactId}`}>{v.name ?? t("payables.vendorsTable.vendorFallback")}</SectionLink>,
      sortValue: (v) => v.name ?? "",
    },
    {
      key: "count",
      phone: "subtitle",
      phoneRender: (v) => [t("payables.vendorsTable.bills", { count: v.billCount }), v.lastPaidOn ? t("payables.vendorsTable.lastPaidOn", { date: calendarDate(v.lastPaidOn, now, locale) }) : null].filter(Boolean).join(" · "),
      header: t("payables.columns.open"),
      render: (v) => t("payables.vendorsTable.bills", { count: v.billCount }),
      sortValue: (v) => v.billCount,
    },
    {
      key: "oldest",
      phone: "trailingSub",
      header: t("payables.columns.oldest"),
      render: (v) => <span className={v.oldestDaysOverdue > 0 ? "font-medium text-overdue" : "text-on-surface-muted"}>{howLate({ dueDate: v.oldestDueDate, daysOverdue: v.oldestDaysOverdue })}</span>,
      sortValue: (v) => (v.oldestDueDate ? v.oldestDaysOverdue : Number.NEGATIVE_INFINITY),
    },
    {
      key: "overdue",
      phone: "hidden",
      header: t("payables.columns.overdue"),
      align: "right",
      render: (v) => (BigInt(v.overdueAmount) > 0n ? <span className="font-semibold tabular-nums text-overdue">{money(v.overdueAmount)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (v) => BigInt(v.overdueAmount),
    },
    { key: "total", phone: "trailing", header: t("payables.columns.totalOwed"), align: "right", render: (v) => <span className="tabular-nums">{money(v.totalOutstanding)}</span>, sortValue: (v) => BigInt(v.totalOutstanding) },
    {
      key: "credit",
      phone: "hidden",
      header: t("payables.columns.creditToUse"),
      align: "right",
      render: (v) => (BigInt(v.credit) > 0n ? <span className="font-semibold tabular-nums text-due-soon">{money(v.credit)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (v) => BigInt(v.credit),
    },
    {
      key: "lastPaid",
      phone: "hidden",
      header: t("payables.columns.lastPaid"),
      render: (v) => (v.lastPaidOn ? <span className="whitespace-nowrap">{calendarDate(v.lastPaidOn, now, locale)}</span> : <span className="text-on-surface-muted">{t("payables.vendorsTable.never")}</span>),
      sortValue: (v) => v.lastPaidOn ?? "",
    },
    {
      key: "actions",
      phone: "action",
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
        name: t("payables.vendorsTable.vendors", { count: vendors.length }),
        count: t("payables.vendorsTable.bills", { count: vendors.reduce((s, v) => s + v.billCount, 0) }),
        overdue: money(sum((v) => v.overdueAmount)),
        total: money(sum((v) => v.totalOutstanding)),
        credit: money(sum((v) => v.credit)),
      }}
      renderExpanded={(v) => <VendorBills vendor={v} now={now} />}
      expandLabel={(v, open) => t(open ? "payables.vendorsTable.hideBills" : "payables.vendorsTable.showBills", { name: v.name ?? t("payables.vendorsTable.theVendor") })}
    />
  );
}

/** A vendor's open bills under their row, oldest due first. */
function VendorBills({ vendor, now }: { vendor: VendorView; now: Date }) {
  const t = useT();
  const locale = orgLocaleTag();
  return (
    <ul className="flex flex-col py-1.5 pl-12 pr-14" aria-label={t("payables.vendorsTable.openBillsList", { name: vendor.name ?? t("payables.vendorsTable.theVendorCapital") })} data-testid="vendor-bills">
      {vendor.bills.map((row) => (
        <li key={row.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-3 py-1.5 text-[13px]">
          <span className="truncate">
            <SectionLink href={`/vendor-bills/${row.id}`} className="font-medium text-primary hover:underline">
              {row.billNumber}
            </SectionLink>
            {row.jobName && <span className="text-on-surface-muted"> · {row.jobName}</span>}
          </span>
          <span className="whitespace-nowrap text-on-surface-muted">
            {t("payables.vendorsTable.due")} <span className="text-on-surface">{row.dueDate ? calendarDate(row.dueDate, now, locale) : "—"}</span>
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
  const t = useT();
  const router = useRouter();
  const canPay = useCapability("vendor_payments.edit_own");
  const canApply = useCapability("vendor_credits.apply");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("payables.vendorsTable.actionsFor", { name: vendor.name ?? t("payables.vendorsTable.thisVendor") })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPay && (
          <DropdownMenuItem onSelect={() => actions.onPay(vendor)}>
            <MENU_ICONS.recordPayment aria-hidden />
            {t("payables.vendorsTable.payVendor")}
          </DropdownMenuItem>
        )}
        {canApply && BigInt(vendor.credit) > 0n && (
          <DropdownMenuItem onSelect={() => actions.onApplyCredit(vendor)}>
            <MENU_ICONS.applyCredit aria-hidden />
            {t("payables.vendorsTable.applyCredit")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(`/contacts/${vendor.contactId}`)}>
          <MENU_ICONS.contact aria-hidden />
          {t("payables.vendorsTable.openContact")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
