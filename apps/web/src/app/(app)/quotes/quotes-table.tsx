"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import Link from "next/link";
import { QuoteRowActions } from "./quote-row-actions";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";
import { formatMoney } from "../../../lib/money";

/** Item 4, user feedback — the newest version of a quote family is always the primary/collapsed row; older, superseded versions expand underneath it. */
function groupPrimary(rows: Quote[]): Quote {
  return rows.reduce((newest, row) => (row.version > newest.version ? row : newest));
}

export const STATUS_BADGE_CLASS: Record<Quote["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * The (only) list view for Quotes — no card/list-view switcher like
 * Contacts, matching Catalogue's own "proportionate scope" precedent. Rows
 * ARE grouped, though (item 4, user feedback): every version of the same
 * quote (linked via `parentQuoteId`, resolved server-side into
 * `rootQuoteId`) collapses into one row showing the newest version, with
 * older/superseded versions expandable underneath — see `@spine/ui`'s
 * `Table`/`DataTable` for the grouping mechanism itself.
 */
export function QuotesTable({ quotes, onDeleted }: { quotes: Quote[]; onDeleted: (quote: Quote) => void }) {
  const columns: TableColumn<Quote>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <Link href={`/quotes/${row.id}`} className="flex items-center gap-1.5 font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ? (
            row.number
          ) : (
            // Item 8, user feedback — plain "Draft" here read like a real
            // reference number (the Status column already carries a "Draft"
            // badge, so repeating the word here was redundant AND
            // confusing — it looked like the quote's number literally WAS
            // the text "Draft"). An em dash + a muted "no number yet"
            // reads unambiguously as "nothing assigned", not a value.
            <span className="italic text-on-surface-muted">— (unsent draft)</span>
          )}
        </Link>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => row.contactName ?? "—",
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge className={STATUS_BADGE_CLASS[row.status]}>{QUOTE_STATUS_LABELS[row.status]}</Badge>
          {row.version > 1 && <Badge className="bg-transparent text-on-surface-muted">v{row.version}</Badge>}
          {row.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
          {row.isSuperseded && <Badge className="bg-transparent text-on-surface-muted">Superseded</Badge>}
        </div>
      ),
    },
    {
      key: "validUntil",
      header: "Valid until",
      render: (row) => (row.validUntil ? new Date(row.validUntil).toLocaleDateString() : "—"),
      sortValue: (row) => row.validUntil ?? "",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(BigInt(row.totalAmount), row.currency)}
        </span>
      ),
      sortValue: (row) => Number(row.totalAmount),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <QuoteRowActions quote={row} onDeleted={onDeleted} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={quotes}
      rowKey={(row) => row.id}
      searchPlaceholder="Search quotes"
      searchKey={(row) => `${row.number ?? ""} ${row.contactName ?? ""}`}
      configurablePageSize
      groupBy={(row) => row.rootQuoteId}
      groupPrimary={groupPrimary}
      groupMemberLabel={(row) => (
        <Badge className="bg-transparent text-on-surface-muted">v{row.version}</Badge>
      )}
    />
  );
}
