"use client";

import Link from "next/link";
import { Badge, DataTable, type TableColumn, type TableSort } from "@spine/ui";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { CreditStateBadge } from "./vendor-credit-detail";
import { VendorCreditRowActions, creditLabel, type CreditRowHandlers } from "./vendor-credit-row-actions";
import { CREDIT_STATES, creditState } from "./vendor-credit-state";
import type { VendorCredit } from "./types";

/**
 * US-PUR-38 (D-226) — the credits list: the number ("—" until a draft is
 * recorded), the vendor's credit note number, the vendor (opening the
 * contact), the date, the bill it's against, the job, the state in words,
 * the total and Left to use ("—" for a void credit), with a row menu.
 * Drafts can be ticked to record together.
 */
export function VendorCreditsTable({
  credits,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  selected,
  onSelectedChange,
  handlers,
}: {
  credits: VendorCredit[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (next: Set<string>) => void;
  handlers: CreditRowHandlers;
}) {
  const locale = orgLocaleTag();
  const muted = <span className="text-on-surface-muted">—</span>;
  const columns: TableColumn<VendorCredit>[] = [
    {
      key: "number",
      header: "Number",
      render: (row) => (
        <span className="flex items-center gap-2">
          <Link href={`/vendor-credits/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline" aria-label={row.number ?? `Draft credit ${row.vendorReference ?? ""}`}>
            {row.number ?? "—"}
          </Link>
          {row.isOpening && <Badge className="bg-draft-bg text-draft">Opening balance</Badge>}
        </span>
      ),
      sortValue: (row) => row.number ?? "",
    },
    { key: "ref", header: "Their no.", render: (row) => row.vendorReference ?? muted, sortValue: (row) => row.vendorReference ?? "" },
    {
      key: "contact",
      header: "Vendor",
      render: (row) => (
        <Link href={`/contacts/${row.contactId}`} className="block max-w-56 truncate text-on-surface hover:text-primary hover:underline" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </Link>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    { key: "date", header: "Date", render: (row) => <span className="whitespace-nowrap">{calendarDate(row.date.slice(0, 10), now, locale)}</span>, sortValue: (row) => row.date.slice(0, 10) },
    {
      key: "bill",
      header: "Against bill",
      render: (row) =>
        row.billId ? (
          <Link href={`/vendor-bills/${row.billId}`} className="font-medium text-primary hover:underline">
            {row.billNumber ?? "A bill"}
          </Link>
        ) : (
          muted
        ),
      sortValue: (row) => row.billNumber ?? "",
    },
    {
      key: "job",
      header: "Job",
      render: (row) => (row.jobId ? <span className="block max-w-44 truncate" title={row.jobName ?? undefined}>{row.jobName ?? "—"}</span> : muted),
      sortValue: (row) => row.jobName ?? "",
    },
    { key: "state", header: "State", render: (row) => <CreditStateBadge credit={row} testId="credit-row-state" />, sortValue: (row) => CREDIT_STATES.indexOf(creditState(row)) },
    { key: "total", header: "Total", align: "right", render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>, sortValue: (row) => BigInt(row.totalAmount) },
    {
      key: "left",
      header: "Left to use",
      align: "right",
      render: (row) => (row.status === "void" ? muted : <span className="tabular-nums">{formatMoney(BigInt(row.status === "draft" ? row.totalAmount : row.balanceAmount), row.currency)}</span>),
      sortValue: (row) => (row.status === "void" ? -1n : BigInt(row.status === "draft" ? row.totalAmount : row.balanceAmount)),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <VendorCreditRowActions credit={row} handlers={handlers} />
        </div>
      ),
    },
  ];

  return (
    <div data-testid="vendor-credits-table">
      <DataTable
        columns={columns}
        data={credits}
        rowKey={(row) => row.id}
        configurablePageSize
        toolbarStart={toolbarStart}
        sort={sort}
        onSortChange={onSortChange}
        page={page}
        onPageChange={onPageChange}
        selected={selected}
        onSelectedChange={onSelectedChange}
        selectLabel={(row) => creditLabel(row)}
      />
    </div>
  );
}
