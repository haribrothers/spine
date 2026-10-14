"use client";

import { Badge, Checkbox, DataTable, cn, type TableColumn, type TableSort } from "@spine/ui";
import Link from "next/link";
import { InvoiceRowActions } from "./invoice-row-actions";
import { INVOICE_STATE_LABELS, dueNote, invoiceState, paidShare, type InvoiceState } from "./invoices-list-state";
import { calendarDate } from "../quotes/quotes-list-state";
import type { Invoice } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";

export const STATE_BADGE_CLASS: Record<InvoiceState, string> = {
  draft: "bg-draft-bg text-draft",
  due: "bg-info-bg text-primary",
  part_paid: "bg-due-soon-bg text-due-soon",
  paid: "bg-paid-bg text-paid",
  overdue: "bg-overdue-bg text-overdue",
  void: "bg-draft-bg text-draft line-through",
};

const TONE_CLASS = { "": "text-on-surface-muted", soon: "font-medium text-due-soon", over: "font-medium text-overdue", paid: "font-medium text-paid" } as const;

/** What sits under the number: "Progress claim 3 · JOB-002", "Deposit", "Opening balance". */
export function invoiceKindNote(inv: Invoice): string | null {
  if (inv.type === "progress" && inv.progressClaimNo) return [`Progress claim ${inv.progressClaimNo}`, inv.job?.number].filter(Boolean).join(" · ");
  if (inv.job) return [inv.job.number, inv.job.name].filter(Boolean).join(" · ");
  if (inv.type === "advance") return "Deposit";
  if (inv.type === "opening") return "Opening balance";
  if (inv.type === "retention_release") return "Retention release";
  return null;
}

/**
 * The invoices table. US-INV-29 (D-217): one status badge, the number with
 * what kind of invoice it is under it, when it was issued, when it's due
 * (or paid), the total, and the balance with a bar of what's paid. Rows
 * can be ticked for the bulk bar (US-INV-23); the page keeps the sort and
 * page in the address (US-INV-28).
 */
export function InvoicesTable({
  invoices,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  onDeleted,
  onActionFailed,
  selected,
  onToggleSelected,
}: {
  invoices: Invoice[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  /** US-INV-23 — ticked rows, for the bulk bar. */
  selected?: Set<string>;
  onToggleSelected?: (invoice: Invoice, selected: boolean) => void;
  onDeleted: (invoice: Invoice) => void;
  onActionFailed?: (invoice: Invoice, message: string) => void;
}) {
  const locale = orgLocaleTag();
  const columns: TableColumn<Invoice>[] = [
    ...(selected && onToggleSelected
      ? [
          {
            key: "select",
            header: "",
            render: (row: Invoice) => (
              <Checkbox checked={selected.has(row.id)} onCheckedChange={(v) => onToggleSelected(row, v === true)} aria-label={`Select ${row.number ?? "draft invoice"}`} />
            ),
          },
        ]
      : []),
    {
      key: "number",
      header: "Number",
      render: (row) => {
        const note = invoiceKindNote(row);
        return (
          <div className="flex max-w-[16rem] flex-col whitespace-normal">
            <Link href={`/invoices/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
              {row.number ?? <span className="font-medium italic text-on-surface-muted">Draft</span>}
            </Link>
            {note && (
              <span className="truncate text-[12.5px] text-on-surface-muted" title={note}>
                {note}
              </span>
            )}
          </div>
        );
      },
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <span className="block max-w-56 truncate" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </span>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const state = invoiceState(row);
        return (
          <Badge className={STATE_BADGE_CLASS[state]} data-testid="invoice-state">
            {INVOICE_STATE_LABELS[state]}
          </Badge>
        );
      },
      sortValue: (row) => invoiceState(row),
    },
    {
      key: "issued",
      header: "Issued",
      render: (row) => (row.issueDate && row.status !== "draft" ? calendarDate(row.issueDate, now, locale) : <span className="text-on-surface-muted">—</span>),
      sortValue: (row) => row.issueDate ?? row.createdAt,
    },
    {
      key: "dueDate",
      header: "Due",
      render: (row) => {
        const note = dueNote(row, now, locale);
        return (
          <div className="flex flex-col">
            <span>{row.dueDate && invoiceState(row) !== "void" ? calendarDate(row.dueDate, now, locale) : "—"}</span>
            {note.text && (
              <span className={cn("text-[12px]", TONE_CLASS[note.tone])} data-testid="invoice-due">
                {note.text}
              </span>
            )}
          </div>
        );
      },
      sortValue: (row) => row.dueDate ?? "",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    {
      key: "balanceDue",
      header: "Balance due",
      align: "right",
      // US-OPS-21: a void invoice owes nothing, so it shows "—", not its old total.
      render: (row) => {
        if (row.status === "void") return <span className="text-on-surface-muted">—</span>;
        const share = row.status === "issued" ? paidShare(row) : 0;
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="tabular-nums">{formatMoney(BigInt(row.balanceDue), row.currency)}</span>
            {share > 0 && (
              <span className="h-1 w-20 overflow-hidden rounded-full bg-border" aria-label={`${share}% paid`} role="img">
                <span className="block h-full rounded-full bg-paid" style={{ width: `${share}%` }} />
              </span>
            )}
          </div>
        );
      },
      sortValue: (row) => (row.status === "void" ? 0n : BigInt(row.balanceDue)),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <InvoiceRowActions invoice={row} onDeleted={onDeleted} onFailed={onActionFailed} />
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
    />
  );
}
