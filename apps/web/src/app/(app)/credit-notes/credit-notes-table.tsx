"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import type { CreditNoteRow, CreditNoteStatus } from "./types";

const STATUS_BADGE_CLASS: Record<CreditNoteStatus, string> = {
  draft: "bg-draft-bg text-draft",
  issued: "bg-due-soon-bg text-due-soon",
};

const STATUS_LABEL: Record<CreditNoteStatus, string> = {
  draft: "Draft",
  issued: "Issued",
};

/**
 * The list view for the org-wide `/credit-notes` page — mirrors
 * payments-table.tsx's flat, no-grouping shape. Clicking the Number cell
 * opens `CreditNoteDetailDrawer` rather than navigating to its own route,
 * same "small record, drawer not page" precedent Payments/Catalogue
 * already established.
 */
export function CreditNotesTable({ creditNotes, onOpen }: { creditNotes: CreditNoteRow[]; onOpen: (creditNote: CreditNoteRow) => void }) {
  const columns: TableColumn<CreditNoteRow>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <button type="button" onClick={() => onOpen(row)} className="text-left font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ?? <span className="italic text-on-surface-muted">Draft</span>}
        </button>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
      sortValue: (row) => row.status,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => (row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : row.date ? new Date(row.date).toLocaleDateString() : "—"),
      sortValue: (row) => row.issuedAt ?? row.date ?? "",
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (row) =>
        row.invoiceNumber ? (
          <a href={`/invoices/${row.invoiceId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.invoiceNumber}
          </a>
        ) : (
          "—"
        ),
      sortValue: (row) => row.invoiceNumber ?? "",
    },
    {
      key: "total",
      header: "Total",
      render: (row) => (
        <span className="font-mono tabular-nums text-overdue">
          -{toDecimalString({ amount: BigInt(row.totalAmount), currency: row.currency })} {row.currency}
        </span>
      ),
      sortValue: (row) => Number(row.totalAmount),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={creditNotes}
      rowKey={(row) => row.id}
      searchPlaceholder="Search credit notes"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""} ${row.invoiceNumber ?? ""} ${row.reason ?? ""}`}
      configurablePageSize
    />
  );
}
