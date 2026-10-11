"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { oldestLabel, type CustomerView } from "./receivables-list-state";
import { AgeCell } from "./receivables-table";

export interface CustomerActions {
  onSendStatement: (customer: CustomerView) => void;
  onRecordPayment: (customer: CustomerView) => void;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * US-PAY-27 (D-224) — "By customer": each customer who owes, with how many
 * open invoices, how late the oldest is, overdue, total owed, credit to use
 * and the last reminder; a totals row; each row opens onto its invoices,
 * oldest due first; a menu to send a statement, record a payment or open
 * the contact.
 */
export function ReceivablesCustomersTable({
  customers,
  currency,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  actions,
}: {
  customers: CustomerView[];
  currency: string;
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  actions: CustomerActions;
}) {
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const sum = (pick: (c: CustomerView) => string) => customers.reduce((s, c) => s + BigInt(pick(c)), 0n);
  const columns: TableColumn<CustomerView>[] = [
    {
      key: "name",
      header: "Customer",
      render: (c) => (
        <Link href={`/contacts/${c.contactId}`} className="block max-w-72 truncate font-semibold text-on-surface hover:text-primary hover:underline" title={c.name ?? undefined}>
          {c.name ?? "Customer"}
        </Link>
      ),
      sortValue: (c) => c.name ?? "",
    },
    { key: "count", header: "Open", render: (c) => plural(c.invoiceCount, "invoice"), sortValue: (c) => c.invoiceCount },
    {
      key: "oldest",
      header: "Oldest",
      render: (c) => <span className={c.oldestDaysOverdue > 0 ? "font-medium text-overdue" : "text-on-surface-muted"}>{oldestLabel(c.oldestDaysOverdue)}</span>,
      sortValue: (c) => c.oldestDaysOverdue,
    },
    {
      key: "overdue",
      header: "Overdue",
      align: "right",
      render: (c) => (BigInt(c.overdueAmount) > 0n ? <span className="font-semibold tabular-nums text-overdue">{money(c.overdueAmount)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (c) => BigInt(c.overdueAmount),
    },
    { key: "total", header: "Total owed", align: "right", render: (c) => <span className="tabular-nums">{money(c.totalOutstanding)}</span>, sortValue: (c) => BigInt(c.totalOutstanding) },
    {
      key: "credit",
      header: "Credit to use",
      align: "right",
      render: (c) => (BigInt(c.credit) > 0n ? <span className="font-semibold tabular-nums text-due-soon">{money(c.credit)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (c) => BigInt(c.credit),
    },
    {
      key: "reminded",
      header: "Last reminded",
      render: (c) => (c.lastReminderOn ? <span className="whitespace-nowrap">{calendarDate(c.lastReminderOn, now, locale)}</span> : <span className="text-on-surface-muted">Never</span>),
      sortValue: (c) => c.lastReminderOn ?? "",
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="flex justify-end">
          <CustomerRowMenu customer={c} actions={actions} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      rowKey={(c) => c.contactId}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      footer={{
        name: plural(customers.length, "customer"),
        count: plural(customers.reduce((s, c) => s + c.invoiceCount, 0), "invoice"),
        overdue: money(sum((c) => c.overdueAmount)),
        total: money(sum((c) => c.totalOutstanding)),
        credit: money(sum((c) => c.credit)),
      }}
      renderExpanded={(c) => <CustomerInvoices customer={c} now={now} />}
      expandLabel={(c, open) => `${open ? "Hide" : "Show"} ${c.name ?? "the customer"}'s invoices`}
    />
  );
}

/** A customer's open invoices under their row, oldest due first. */
function CustomerInvoices({ customer, now }: { customer: CustomerView; now: Date }) {
  const locale = orgLocaleTag();
  return (
    <ul className="flex flex-col py-1.5 pl-12 pr-14" aria-label={`${customer.name ?? "The customer"}'s open invoices`} data-testid="customer-invoices">
      {customer.invoices.map((row) => (
        <li key={row.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-3 py-1.5 text-[13px]">
          <span className="truncate">
            <Link href={`/invoices/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number ?? "Invoice"}
            </Link>
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

/** US-PAY-28 — Send statement, Record payment and Open contact. */
function CustomerRowMenu({ customer, actions }: { customer: CustomerView; actions: CustomerActions }) {
  const router = useRouter();
  const canRecord = useCapability("payments.edit_own");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${customer.name ?? "this customer"}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => actions.onSendStatement(customer)}>
          <MENU_ICONS.statement aria-hidden />
          Send statement
        </DropdownMenuItem>
        {canRecord && (
          <DropdownMenuItem onSelect={() => actions.onRecordPayment(customer)}>
            <MENU_ICONS.recordPayment aria-hidden />
            Record payment
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(`/contacts/${customer.contactId}`)}>
          <MENU_ICONS.contact aria-hidden />
          Open contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
