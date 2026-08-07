"use client";

import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";

const STATUS_BADGE_CLASS: Record<Quote["status"], string> = {
  draft: "bg-draft-bg text-draft",
  sent: "bg-due-soon-bg text-due-soon",
  accepted: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/** The (only) list view for Quotes — a flat table, matching Catalogue's own "no view switcher" precedent for a module without pipeline/relationship complexity. */
export function QuotesTable({ quotes }: { quotes: Quote[] }) {
  const columns: TableColumn<Quote>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <Link href={`/quotes/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
          {row.number ?? "Draft"}
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
          {row.isExpired && <Badge className="bg-overdue-bg text-overdue">Expired</Badge>}
          {row.isSuperseded && <Badge className="bg-transparent text-on-surface-muted">v{row.version} · Superseded</Badge>}
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
      render: (row) => (
        <span className="font-mono tabular-nums">
          {toDecimalString({ amount: BigInt(row.totalAmount), currency: row.currency })} {row.currency}
        </span>
      ),
      sortValue: (row) => Number(row.totalAmount),
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
    />
  );
}
