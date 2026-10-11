"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { PAYMENT_METHOD_LABELS, type Payment } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-PAY-21 (D-221) — the payments table: the receipt number with the
 * reference under it, the date, the customer, the method with the account
 * under it, the amount, what it was applied to and the credit left, with a
 * row menu. The page keeps the sort and page in the address (US-PAY-22).
 */
export function PaymentsTable({
  payments,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
}: {
  payments: Payment[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
}) {
  const locale = orgLocaleTag();
  const columns: TableColumn<Payment>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <div className="flex max-w-[14rem] flex-col">
          <Link href={`/payments/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
            {row.number ?? "Payment"}
          </Link>
          {row.reference && (
            <span className="truncate text-[12.5px] text-on-surface-muted" title={row.reference}>
              {row.reference}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <span className="whitespace-nowrap">{calendarDate(row.date.slice(0, 10), now, locale)}</span>,
      sortValue: (row) => `${row.date.slice(0, 10)}${row.createdAt}`,
    },
    {
      key: "contact",
      header: "Customer",
      render: (row) => (
        <span className="block max-w-56 truncate" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </span>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "method",
      header: "Method",
      render: (row) => (
        <div className="flex flex-col">
          <span>{PAYMENT_METHOD_LABELS[row.method]}</span>
          {row.moneyAccountName && <span className="text-[12px] text-on-surface-muted">{row.moneyAccountName}</span>}
        </div>
      ),
      sortValue: (row) => PAYMENT_METHOD_LABELS[row.method],
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.amount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.amount),
    },
    {
      key: "applied",
      header: "Applied to",
      render: (row) => {
        const to = row.appliedTo ?? [];
        if (!to.length) return <span className="text-[13px] text-on-surface-muted">Not applied</span>;
        if (to.length > 2) return <span className="text-[13px]">{to.length} invoices</span>;
        return (
          <span className="text-[13px]" data-testid="payment-applied-to">
            {to.map((a, i) => (
              <Fragment key={a.invoiceId}>
                {i > 0 && ", "}
                <Link href={`/invoices/${a.invoiceId}`} className="text-primary hover:underline">
                  {a.number ?? "Invoice"}
                </Link>
              </Fragment>
            ))}
          </span>
        );
      },
      sortValue: (row) => (row.appliedTo ?? []).length,
    },
    {
      key: "credit",
      header: "Credit left",
      align: "right",
      render: (row) =>
        BigInt(row.unallocatedAmount) > 0n ? (
          <span className="font-semibold tabular-nums text-due-soon" data-testid="payment-credit-left">
            {formatMoney(BigInt(row.unallocatedAmount), row.currency)}
          </span>
        ) : (
          <span className="text-on-surface-muted">—</span>
        ),
      sortValue: (row) => BigInt(row.unallocatedAmount),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <PaymentRowActions payment={row} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={payments}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
    />
  );
}

/**
 * US-PAY-21 — a payment row's menu: View, Apply credit and Refund while
 * credit is left, Email receipt, Download PDF and Delete payment (nothing
 * applied or refunded), each only with the right to do it. All but View
 * and Download open the payment's page with that dialog (`?action=`), so
 * nothing happens in one click (D-218).
 */
function PaymentRowActions({ payment }: { payment: Payment }) {
  const router = useRouter();
  const canApply = useCapability("payments.apply_credit");
  const canRefund = useCapability("payments.refund");
  const canSend = useCapability("payments.send_receipt");
  const canDeleteRight = useCanEditOwnership(payment.createdByUserId, { own: "payments.delete_own", others: "payments.delete_others" });
  const left = BigInt(payment.unallocatedAmount) > 0n;
  const canDelete = canDeleteRight && payment.allocatedAmount === "0" && BigInt(payment.refundedAmount ?? "0") === 0n;
  const open = (action?: string) => router.push(`/payments/${payment.id}${action ? `?action=${action}` : ""}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${payment.number ?? "this payment"}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => open()}>
          <MENU_ICONS.view aria-hidden />
          View
        </DropdownMenuItem>
        {left && canApply && (
          <DropdownMenuItem onSelect={() => open("apply")}>
            <MENU_ICONS.applyCredit aria-hidden />
            Apply credit
          </DropdownMenuItem>
        )}
        {left && canRefund && (
          <DropdownMenuItem onSelect={() => open("refund")}>
            <MENU_ICONS.refund aria-hidden />
            Refund
          </DropdownMenuItem>
        )}
        {canSend && (
          <DropdownMenuItem onSelect={() => open("email")}>
            <MENU_ICONS.email aria-hidden />
            Email receipt
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={`${API_URL}/payments/${payment.id}/pdf`} target="_blank" rel="noreferrer">
            <MENU_ICONS.download aria-hidden />
            Download PDF
          </a>
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => open("delete")}>
              <MENU_ICONS.delete aria-hidden />
              Delete payment
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
