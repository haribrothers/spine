"use client";

import Link from "next/link";
import { Badge, DataTable, cn, type TableColumn, type TableSort } from "@spine/ui";
import { calendarDate } from "../quotes/quotes-list-state";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { CreditNoteRowActions } from "./credit-note-row-actions";
import { CREDIT_NOTE_STATE_LABELS, creditNoteState, whereItWent } from "./credit-notes-list-state";
import { STATE_BADGE } from "./credit-note-detail";
import type { CreditNoteRow } from "./types";

import { SectionLink } from "../../../components/section-link";
import { useT } from "../../../lib/i18n";
const WHERE_TONE = { off: "text-on-surface-muted", applied: "text-on-surface-muted", refunded: "font-medium text-paid", left: "font-semibold text-due-soon" } as const;

/**
 * US-INV-40 (D-219) — the credit notes table: the number with the reason
 * under it, the customer, the invoice it corrects, the date, the total and
 * "Where it went" (off the invoice, applied, refunded, credit left), with a
 * row menu. The page keeps the sort and page in the address (US-INV-41).
 */
export function CreditNotesTable({
  creditNotes,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
}: {
  creditNotes: CreditNoteRow[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const columns: TableColumn<CreditNoteRow>[] = [
    {
      key: "number",
      header: t("creditNotes.columns.number"),
      render: (row) => (
        <div className="flex max-w-[18rem] flex-col whitespace-normal">
          <Link href={`/credit-notes/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
            {row.number ?? <span className="font-medium italic text-on-surface-muted">{t("creditNotes.table.draft")}</span>}
          </Link>
          {row.reason && (
            <span className="truncate text-[12.5px] text-on-surface-muted" title={row.reason}>
              {row.reason}
            </span>
          )}
        </div>
      ),
      // US-OPS-56: on a phone, the number alone; the customer and the invoice go on the second line.
      phone: "title",
      phoneRender: (row) => (
        <Link href={`/credit-notes/${row.id}`}>{row.number ?? <span className="font-medium italic text-on-surface-muted">{t("creditNotes.table.draft")}</span>}</Link>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      phone: "subtitle",
      phoneRender: (row) => [row.contactName ?? "—", row.invoiceNumber ?? row.reason].filter(Boolean).join(" · "),
      header: t("creditNotes.table.customer"),
      render: (row) => (
        <span className="block max-w-56 truncate" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </span>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "invoice",
      phone: "hidden",
      header: t("creditNotes.columns.invoice"),
      render: (row) =>
        row.invoiceNumber ? (
          <SectionLink href={`/invoices/${row.invoiceId}`} className="text-primary hover:underline">
            {row.invoiceNumber}
          </SectionLink>
        ) : (
          "—"
        ),
      sortValue: (row) => row.invoiceNumber ?? "",
    },
    {
      key: "date",
      phone: "trailingSub",
      header: t("creditNotes.columns.date"),
      render: (row) => {
        const day = (row.issuedAt ?? row.date ?? "").slice(0, 10);
        return day ? calendarDate(day, now, locale) : <span className="text-on-surface-muted">—</span>;
      },
      sortValue: (row) => row.issuedAt ?? row.date ?? row.createdAt,
    },
    {
      key: "total",
      phone: "trailing",
      header: t("creditNotes.columns.total"),
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    {
      key: "where",
      // On a phone, where the money went is said by the state badge: Draft, Credit left or Credited.
      phone: "badge",
      phoneRender: (row) => {
        const state = creditNoteState(row);
        return <Badge className={STATE_BADGE[state]}>{CREDIT_NOTE_STATE_LABELS[state]}</Badge>;
      },
      header: t("creditNotes.table.whereItWent"),
      render: (row) => {
        if (row.status !== "issued") return <span className="text-[12.5px] italic text-on-surface-muted">{t("creditNotes.table.draftNotIssued")}</span>;
        const parts = whereItWent(row);
        return (
          <span className="flex flex-wrap items-center gap-x-1.5 text-[12.5px]" data-testid="where-it-went">
            {parts.map((p, i) => (
              <span key={p.kind} className={cn(WHERE_TONE[p.kind])}>
                {p.text}
                {i < parts.length - 1 ? " ·" : ""}
              </span>
            ))}
          </span>
        );
      },
      sortValue: (row) => BigInt(row.creditRemainingAmount ?? "0"),
    },
    {
      key: "actions",
      phone: "action",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <CreditNoteRowActions note={row} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={creditNotes}
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
