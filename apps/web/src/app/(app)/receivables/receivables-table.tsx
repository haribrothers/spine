"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
  type TableColumn,
  type TableSort,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { calendarDate } from "../quotes/quotes-list-state";
import { howLate, reminderBlocked } from "./receivables-list-state";
import { AGING_BUCKET_LABELS, type AgingBucket, type ReceivablesInvoiceRow } from "./types";

import { SectionLink } from "../../../components/section-link";
import { useT } from "../../../lib/i18n";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const BUCKET_BADGE_CLASS: Record<AgingBucket, string> = {
  current: "bg-paid-bg text-paid",
  "0-30": "bg-due-soon-bg text-due-soon",
  "31-60": "bg-overdue-bg text-overdue",
  "61-90": "bg-overdue-bg text-overdue",
  "90+": "bg-overdue-bg text-overdue",
};

/** The coloured age and how late in words beside it (US-PAY-30) — colour is never the only sign. */
export function AgeCell({ row }: { row: Pick<ReceivablesInvoiceRow, "bucket" | "dueDate" | "daysOverdue"> }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Badge className={BUCKET_BADGE_CLASS[row.bucket]}>{AGING_BUCKET_LABELS[row.bucket]}</Badge>
      <span className={cn("text-[12.5px]", row.daysOverdue > 0 ? "font-medium text-overdue" : "text-on-surface-muted")}>{howLate(row)}</span>
    </span>
  );
}

export interface InvoiceActions {
  onRecordPayment: (row: ReceivablesInvoiceRow) => void;
  onApplyCredit: (row: ReceivablesInvoiceRow) => void;
  onSendReminder: (row: ReceivablesInvoiceRow) => void;
  /** Whether the customer has credit to apply. */
  hasCredit: (contactId: string) => boolean;
}

/**
 * US-PAY-28/US-PAY-30 (D-224) — "By invoice": the number with the job (and
 * Deposit) under it, the customer, the due date in the business's format
 * with the last reminder under it, the coloured age with how late in
 * words, and the balance; Issued, Invoice total and Paid so far in
 * Columns. Rows can be ticked for Send reminders, and each has a menu.
 */
export function ReceivablesTable({
  invoices,
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
  invoices: ReceivablesInvoiceRow[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  actions: InvoiceActions;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const date = (iso: string | null) => (iso ? calendarDate(iso, now, locale) : "—");
  const money = (row: ReceivablesInvoiceRow, v: string) => <span className="tabular-nums">{formatMoney(BigInt(v), row.currency)}</span>;
  const columns: TableColumn<ReceivablesInvoiceRow>[] = [
    {
      key: "number",
      header: t("receivables.table.invoice"),
      render: (row) => (
        <div className="flex max-w-[14rem] flex-col">
          <SectionLink href={`/invoices/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
            {row.number ?? t("receivables.table.invoice")}
          </SectionLink>
          {(row.jobName || row.type === "advance") && (
            <span className="truncate text-[12px] text-on-surface-muted">
              {row.jobName}
              {row.jobName && row.type === "advance" && " · "}
              {row.type === "advance" && <span className="font-medium text-primary">{t("receivables.table.deposit")}</span>}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: t("receivables.table.customer"),
      render: (row) => (
        <SectionLink href={`/contacts/${row.contactId}`} className="block max-w-56 truncate text-on-surface hover:text-primary hover:underline" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </SectionLink>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "dueDate",
      header: t("receivables.table.due"),
      render: (row) => (
        <div className="flex flex-col whitespace-nowrap">
          <span>{date(row.dueDate)}</span>
          <span className="text-[12px] text-on-surface-muted" data-testid="receivable-reminded">
            {row.lastReminderOn ? t("receivables.table.lastReminded", { date: date(row.lastReminderOn) }) : t("receivables.table.neverReminded")}
          </span>
        </div>
      ),
      sortValue: (row) => row.dueDate ?? "",
    },
    { key: "late", header: t("receivables.table.howLate"), render: (row) => <AgeCell row={row} />, sortValue: (row) => row.daysOverdue },
    { key: "issueDate", header: t("receivables.table.issued"), render: (row) => <span className="whitespace-nowrap">{date(row.issueDate)}</span>, sortValue: (row) => row.issueDate ?? "" },
    { key: "totalAmount", header: t("receivables.table.invoiceTotal"), align: "right", render: (row) => money(row, row.totalAmount), sortValue: (row) => BigInt(row.totalAmount) },
    { key: "paidAmount", header: t("receivables.table.paidSoFar"), align: "right", render: (row) => money(row, row.paidAmount), sortValue: (row) => BigInt(row.paidAmount) },
    { key: "balanceDue", header: t("receivables.table.balanceDue"), align: "right", render: (row) => money(row, row.balanceDue), sortValue: (row) => BigInt(row.balanceDue) },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <InvoiceRowMenu row={row} actions={actions} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={invoices}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={(row) => row.number ?? t("receivables.table.selectLabel")}
      defaultHidden={["issueDate", "totalAmount", "paidAmount"]}
    />
  );
}

/** US-PAY-28 — Record payment, Apply credit (with credit to use), Send reminder (or why not), Download PDF and Open invoice, each with its right. */
function InvoiceRowMenu({ row, actions }: { row: ReceivablesInvoiceRow; actions: InvoiceActions }) {
  const t = useT();
  const router = useRouter();
  const canRecord = useCapability("payments.edit_own");
  const canApply = useCapability("payments.apply_credit");
  const canRemind = useCapability("invoices.send_reminder");
  const blocked = reminderBlocked(row);
  const label = row.number ?? t("receivables.table.thisInvoice");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("receivables.table.actionsFor", { label })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {canRecord && (
          <DropdownMenuItem onSelect={() => actions.onRecordPayment(row)}>
            <MENU_ICONS.recordPayment aria-hidden />
            {t("receivables.table.recordPayment")}
          </DropdownMenuItem>
        )}
        {canApply && row.type !== "advance" && actions.hasCredit(row.contactId) && (
          <DropdownMenuItem onSelect={() => actions.onApplyCredit(row)}>
            <MENU_ICONS.applyCredit aria-hidden />
            {t("receivables.table.applyCredit")}
          </DropdownMenuItem>
        )}
        {canRemind && (
          <DropdownMenuItem disabled={Boolean(blocked)} onSelect={() => actions.onSendReminder(row)}>
            <MENU_ICONS.remind aria-hidden />
            <span className="flex flex-1 flex-col">
              {t("receivables.table.sendReminder")}
              {blocked && <span className="text-[11.5px] text-on-surface-muted">{blocked}</span>}
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={`${API_URL}/invoices/${row.id}/pdf`} target="_blank" rel="noreferrer">
            <MENU_ICONS.download aria-hidden />
            {t("receivables.table.downloadPdf")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(`/invoices/${row.id}`)}>
          <MENU_ICONS.open aria-hidden />
          {t("receivables.table.openInvoice")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
