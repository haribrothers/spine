"use client";

import { Badge, DataTable, Tooltip, TooltipContent, TooltipTrigger, cn, type TableColumn, type TableSort } from "@spine/ui";
import { Eye } from "lucide-react";
import Link from "next/link";
import { QuoteRowActions } from "./quote-row-actions";
import { calendarDate, shortDate, validityNote } from "./quotes-list-state";
import { QUOTE_STATUS_LABELS, type Quote } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { useT } from "../../../lib/i18n";

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

/** US-QUO-29 — "Viewed 3×", with the last view on hover and for screen readers. */
export function ViewedChip({ quote, now }: { quote: Quote; now: Date }) {
  const t = useT();
  if (!quote.viewCount) return null;
  const last = quote.lastViewedAt ? t("quotes.table.lastViewed", { date: shortDate(quote.lastViewedAt, now, orgLocaleTag()), time: new Date(quote.lastViewedAt).toLocaleTimeString(orgLocaleTag(), { hour: "numeric", minute: "2-digit" }) }) : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-[12px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="quote-viewed" aria-label={t("quotes.table.viewedAria", { count: quote.viewCount, last })}>
          <Eye size={13} aria-hidden />
          {t("quotes.table.viewed", { views: quote.viewCount })}
        </span>
      </TooltipTrigger>
      {last && <TooltipContent>{last}</TooltipContent>}
    </Tooltip>
  );
}

/**
 * The quotes table. Every version of a quote groups under its newest
 * (item 4, user feedback). US-QUO-29 (D-214): the title under the number,
 * the customer's views beside the status, when it was sent, and how long
 * it has left; the page keeps the sort and page in the address (US-QUO-28).
 */
export function QuotesTable({
  quotes,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  onDeleted,
  onNotify,
  onActionFailed,
}: {
  quotes: Quote[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  onDeleted: (quote: Quote) => void;
  onNotify: (title: string, description: string) => void;
  onActionFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const columns: TableColumn<Quote>[] = [
    {
      key: "number",
      header: t("quotes.table.number"),
      render: (row) => (
        <div className="flex max-w-[22rem] flex-col whitespace-normal">
          <Link href={`/quotes/${row.id}`} className="flex items-center gap-1.5 font-semibold text-on-surface hover:text-primary hover:underline">
            {row.number ?? <span className="font-medium italic text-on-surface-muted">{t("quotes.status.draft")}</span>}
            {row.version > 1 && <span className="text-[11.5px] font-medium text-on-surface-muted">{t("quotes.table.version", { version: row.version })}</span>}
          </Link>
          {row.title && (
            <span className="truncate text-[12.5px] text-on-surface-muted" title={row.title}>
              {row.title}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.number ?? "",
    },
    {
      key: "contact",
      header: t("quotes.table.contact"),
      render: (row) => <span className="block max-w-[16rem] truncate" title={row.contactName ?? undefined}>{row.contactName ?? "—"}</span>,
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      header: t("quotes.table.status"),
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={STATUS_BADGE_CLASS[row.status]}>{QUOTE_STATUS_LABELS[row.status]}</Badge>
          {row.isExpired && <Badge className="bg-overdue-bg text-overdue">{t("quotes.status.expired")}</Badge>}
          {row.isSuperseded && <Badge className="bg-transparent text-on-surface-muted">{t("quotes.status.superseded")}</Badge>}
          <ViewedChip quote={row} now={now} />
        </div>
      ),
      sortValue: (row) => row.status,
    },
    {
      key: "sent",
      header: t("quotes.table.sent"),
      render: (row) => (row.sentAt ? shortDate(row.sentAt, now, locale) : <span className="text-on-surface-muted">—</span>),
      sortValue: (row) => row.sentAt ?? "",
    },
    {
      key: "validUntil",
      header: t("quotes.table.validUntil"),
      render: (row) => {
        const note = validityNote(row, now, locale);
        return (
          <div className="flex flex-col">
            <span>{row.validUntil ? calendarDate(row.validUntil, now, locale) : "—"}</span>
            {note.text && (
              <span className={cn("text-[12px]", note.tone === "soon" ? "font-medium text-due-soon" : note.tone === "gone" ? "font-medium text-overdue" : "text-on-surface-muted")} data-testid="quote-validity">
                {note.text}
              </span>
            )}
          </div>
        );
      },
      sortValue: (row) => row.validUntil ?? "",
    },
    {
      key: "total",
      header: t("quotes.table.total"),
      align: "right",
      render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.totalAmount), row.currency)}</span>,
      sortValue: (row) => BigInt(row.totalAmount),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <QuoteRowActions quote={row} onDeleted={onDeleted} onNotify={onNotify} onFailed={onActionFailed} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={quotes}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      groupBy={(row) => row.rootQuoteId}
      groupPrimary={groupPrimary}
      groupMemberLabel={(row) => <Badge className="bg-transparent text-on-surface-muted">{t("quotes.table.version", { version: row.version })}</Badge>}
    />
  );
}
