"use client";

import { useRouter } from "next/navigation";
import { DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type TableColumn, type TableSort } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { oldestLabel, type CustomerView } from "./receivables-list-state";
import { AgeCell } from "./receivables-table";

import { SectionLink } from "../../../components/section-link";
import { useT } from "../../../lib/i18n";
export interface CustomerActions {
  onSendStatement: (customer: CustomerView) => void;
  onRecordPayment: (customer: CustomerView) => void;
}

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
  const t = useT();
  const locale = orgLocaleTag();
  const money = (v: string | bigint) => formatMoney(BigInt(v), currency);
  const sum = (pick: (c: CustomerView) => string) => customers.reduce((s, c) => s + BigInt(pick(c)), 0n);
  const columns: TableColumn<CustomerView>[] = [
    {
      key: "name",
      header: t("receivables.customersTable.customer"),
      render: (c) => (
        <SectionLink href={`/contacts/${c.contactId}`} className="block max-w-72 truncate font-semibold text-on-surface hover:text-primary hover:underline" title={c.name ?? undefined}>
          {c.name ?? t("receivables.customersTable.customer")}
        </SectionLink>
      ),
      // US-OPS-56: on a phone, the name; how many invoices and the last reminder go on the second line.
      phone: "title",
      phoneRender: (c) => <SectionLink href={`/contacts/${c.contactId}`}>{c.name ?? t("receivables.customersTable.customer")}</SectionLink>,
      sortValue: (c) => c.name ?? "",
    },
    {
      key: "count",
      phone: "subtitle",
      phoneRender: (c) =>
        [t("receivables.customersTable.invoiceCount", { count: c.invoiceCount }), c.lastReminderOn ? t("receivables.table.lastReminded", { date: calendarDate(c.lastReminderOn, now, locale) }) : null].filter(Boolean).join(" · "),
      header: t("receivables.customersTable.open"), render: (c) => t("receivables.customersTable.invoiceCount", { count: c.invoiceCount }),
      sortValue: (c) => c.invoiceCount,
    },
    {
      key: "oldest",
      phone: "trailingSub",
      header: t("receivables.customersTable.oldest"),
      render: (c) => <span className={c.oldestDaysOverdue > 0 ? "font-medium text-overdue" : "text-on-surface-muted"}>{oldestLabel(c.oldestDaysOverdue)}</span>,
      sortValue: (c) => c.oldestDaysOverdue,
    },
    {
      key: "overdue",
      phone: "hidden",
      header: t("receivables.customersTable.overdue"),
      align: "right",
      render: (c) => (BigInt(c.overdueAmount) > 0n ? <span className="font-semibold tabular-nums text-overdue">{money(c.overdueAmount)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (c) => BigInt(c.overdueAmount),
    },
    { key: "total", phone: "trailing", header: t("receivables.customersTable.totalOwed"), align: "right", render: (c) => <span className="tabular-nums">{money(c.totalOutstanding)}</span>, sortValue: (c) => BigInt(c.totalOutstanding) },
    {
      key: "credit",
      phone: "hidden",
      header: t("receivables.customersTable.creditToUse"),
      align: "right",
      render: (c) => (BigInt(c.credit) > 0n ? <span className="font-semibold tabular-nums text-due-soon">{money(c.credit)}</span> : <span className="text-on-surface-muted">—</span>),
      sortValue: (c) => BigInt(c.credit),
    },
    {
      key: "reminded",
      phone: "hidden",
      header: t("receivables.customersTable.lastReminded"),
      render: (c) => (c.lastReminderOn ? <span className="whitespace-nowrap">{calendarDate(c.lastReminderOn, now, locale)}</span> : <span className="text-on-surface-muted">{t("receivables.customersTable.never")}</span>),
      sortValue: (c) => c.lastReminderOn ?? "",
    },
    {
      key: "actions",
      phone: "action",
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
        name: t("receivables.customersTable.customerCount", { count: customers.length }),
        count: t("receivables.customersTable.invoiceCount", { count: customers.reduce((s, c) => s + c.invoiceCount, 0) }),
        overdue: money(sum((c) => c.overdueAmount)),
        total: money(sum((c) => c.totalOutstanding)),
        credit: money(sum((c) => c.credit)),
      }}
      renderExpanded={(c) => <CustomerInvoices customer={c} now={now} />}
      expandLabel={(c, open) => t(open ? "receivables.customersTable.hideInvoices" : "receivables.customersTable.showInvoices", { name: c.name ?? t("receivables.customersTable.theCustomer") })}
    />
  );
}

/** A customer's open invoices under their row, oldest due first. */
function CustomerInvoices({ customer, now }: { customer: CustomerView; now: Date }) {
  const t = useT();
  const locale = orgLocaleTag();
  return (
    <ul className="flex flex-col py-1.5 pl-12 pr-14" aria-label={t("receivables.customersTable.openInvoicesAria", { name: customer.name ?? t("receivables.customersTable.theCustomerCap") })} data-testid="customer-invoices">
      {customer.invoices.map((row) => (
        <li key={row.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-3 py-1.5 text-[13px]">
          <span className="truncate">
            <SectionLink href={`/invoices/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number ?? t("receivables.customersTable.invoice")}
            </SectionLink>
            {row.jobName && <span className="text-on-surface-muted"> · {row.jobName}</span>}
          </span>
          <span className="whitespace-nowrap text-on-surface-muted">
            {t("receivables.customersTable.due")} <span className="text-on-surface">{row.dueDate ? calendarDate(row.dueDate, now, locale) : "—"}</span>
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
  const t = useT();
  const router = useRouter();
  const canRecord = useCapability("payments.edit_own");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("receivables.customersTable.actionsFor", { name: customer.name ?? t("receivables.customersTable.thisCustomer") })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => actions.onSendStatement(customer)}>
          <MENU_ICONS.statement aria-hidden />
          {t("receivables.customersTable.sendStatement")}
        </DropdownMenuItem>
        {canRecord && (
          <DropdownMenuItem onSelect={() => actions.onRecordPayment(customer)}>
            <MENU_ICONS.recordPayment aria-hidden />
            {t("receivables.customersTable.recordPayment")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(`/contacts/${customer.contactId}`)}>
          <MENU_ICONS.contact aria-hidden />
          {t("receivables.customersTable.openContact")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
