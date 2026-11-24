"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { useT } from "../../../lib/i18n";
import { calendarDate } from "../quotes/quotes-list-state";
import { PAYMENT_METHOD_LABELS, type VendorPaymentRow } from "./types";

import { SectionLink } from "../../../components/section-link";
/**
 * US-PUR-51 (D-222) — a row's menu: View, Download remittance advice,
 * Email remittance advice and Delete payment, each with its icon and right,
 * destructive last. Email and Delete open the payment's page with that
 * dialog, so nothing happens in one click (D-218).
 */
function RowActions({ payment, onDownload }: { payment: VendorPaymentRow; onDownload: (p: VendorPaymentRow) => void }) {
  const t = useT();
  const router = useRouter();
  const canEmail = useCanEditOwnership(payment.createdByUserId, { own: "vendor_payments.edit_own", others: "vendor_payments.edit_others" });
  const canDelete = useCanEditOwnership(payment.createdByUserId, { own: "vendor_payments.delete_own", others: "vendor_payments.delete_others" });
  const label = payment.number ?? t("vendorPayments.table.thisPayment");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t("vendorPayments.table.actionsFor", { name: label })} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface">
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push(`/vendor-payments/${payment.id}`)}>
          <MENU_ICONS.view aria-hidden />
          {t("vendorPayments.table.view")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDownload(payment)}>
          <MENU_ICONS.download aria-hidden />
          {t("vendorPayments.table.downloadRemittance")}
        </DropdownMenuItem>
        {canEmail && payment.paidTo.length > 0 && (
          <DropdownMenuItem onSelect={() => router.push(`/vendor-payments/${payment.id}?action=email`)}>
            <MENU_ICONS.email aria-hidden />
            {t("vendorPayments.table.emailRemittance")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => router.push(`/vendor-payments/${payment.id}?action=delete`)}>
              <MENU_ICONS.delete aria-hidden />
              {t("vendorPayments.table.deletePayment")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * US-PUR-51 (D-229) — the list: the number with the reference under it
 * (opening the payment), the date in the business's format, the vendor,
 * the method with the account under it, the amount and the bills it paid;
 * newest first.
 */
export function VendorPaymentsTable({
  payments,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  onDownload,
}: {
  payments: VendorPaymentRow[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  onDownload: (p: VendorPaymentRow) => void;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const columns: TableColumn<VendorPaymentRow>[] = [
    {
      key: "number",
      header: t("vendorPayments.columns.number"),
      render: (row) => (
        <Link href={`/vendor-payments/${row.id}`} className="flex min-w-0 flex-col hover:text-primary">
          <span className="font-semibold text-on-surface">{row.number ?? "—"}</span>
          {row.reference && <span className="truncate text-[12px] text-on-surface-muted">{row.reference}</span>}
        </Link>
      ),
      // US-OPS-56: on a phone, the number alone; who was paid and how go on the second line.
      phone: "title",
      phoneRender: (row) => <Link href={`/vendor-payments/${row.id}`}>{row.number ?? "—"}</Link>,
      sortValue: (row) => row.number ?? "",
    },
    { key: "date", phone: "trailingSub", header: t("vendorPayments.columns.date"), render: (row) => <span className="whitespace-nowrap">{calendarDate(row.date.slice(0, 10), now, locale)}</span>, sortValue: (row) => `${row.date.slice(0, 10)}${row.createdAt}` },
    {
      key: "vendor",
      phone: "subtitle",
      phoneRender: (row) => [row.contactName ?? "—", PAYMENT_METHOD_LABELS[row.method]].join(" · "),
      header: t("vendorPayments.columns.vendor"), render: (row) => <span className="block max-w-64 truncate">{row.contactName ?? "—"}</span>,
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "method",
      phone: "hidden",
      header: t("vendorPayments.columns.method"),
      render: (row) => (
        <span className="flex flex-col">
          <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
          {row.moneyAccountName && <span className="text-[12px] text-on-surface-muted">{row.moneyAccountName}</span>}
        </span>
      ),
      sortValue: (row) => row.method,
    },
    { key: "amount", phone: "trailing", header: t("vendorPayments.columns.amount"), align: "right", render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.amount), row.currency)}</span>, sortValue: (row) => BigInt(row.amount) },
    {
      key: "bills",
      phone: "hidden",
      header: t("vendorPayments.columns.billsPaid"),
      render: (row) =>
        row.paidTo.length === 0 ? (
          <span className="text-on-surface-muted">—</span>
        ) : row.paidTo.length > 2 ? (
          <span>{t("vendorPayments.table.billCount", { count: row.paidTo.length })}</span>
        ) : (
          <span className="flex flex-wrap gap-x-1">
            {row.paidTo.map((b, i) => (
              <span key={b.billId}>
                <SectionLink href={`/vendor-bills/${b.billId}`} className="text-primary hover:underline">
                  {b.number}
                </SectionLink>
                {i < row.paidTo.length - 1 ? "," : ""}
              </span>
            ))}
          </span>
        ),
      sortValue: (row) => row.paidTo.map((b) => b.number).join(","),
    },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <RowActions payment={row} onDownload={onDownload} />
        </div>
      ),
    },
  ];

  return (
    <div data-testid="vendor-payments-table">
      <DataTable columns={columns} data={payments} rowKey={(row) => row.id} configurablePageSize toolbarStart={toolbarStart} sort={sort} onSortChange={onSortChange} page={page} onPageChange={onPageChange} />
    </div>
  );
}
