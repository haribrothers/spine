"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, cn, type TableColumn, type TableSort } from "@spine/ui";
import { EMAIL_KIND_LABELS, EMAIL_LOG_STATUS_LABELS, emailRecordHref, type EmailLogEntry, type EmailLogStatus } from "@spine/shared";
import { MoreHorizontal } from "lucide-react";
import { orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { emailNote } from "./emails-list-state";

const STATUS_CLASS: Record<EmailLogStatus, string> = {
  queued: "bg-draft-bg text-draft",
  retrying: "bg-due-soon-bg text-due-soon",
  sending: "bg-info-bg text-primary",
  sent: "bg-paid-bg text-paid",
  failed: "bg-overdue-bg text-overdue",
  cancelled: "bg-draft-bg text-draft line-through",
};

/**
 * US-SET-27/28 (D-220) — the email log's table: when, to whom, the kind and
 * subject (with the error, the next try or who cancelled under it), the
 * record, the status in words and the attempts, with a row menu: Retry now
 * and Cancel for a queued email (each asks first, in the explorer), and the
 * record to open.
 */
export function EmailsTable({
  emails,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
  onRetry,
  onCancel,
}: {
  emails: EmailLogEntry[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
  onRetry: (email: EmailLogEntry) => void;
  onCancel: (email: EmailLogEntry) => void;
}) {
  const locale = orgLocaleTag();
  const columns: TableColumn<EmailLogEntry>[] = [
    {
      key: "when",
      header: "When",
      render: (row) => {
        const at = row.sentAt ?? row.queuedAt;
        const day = new Date(at);
        const today = day.toDateString() === now.toDateString();
        return (
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-medium text-on-surface">{day.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
            <span className="text-[12px] text-on-surface-muted">{today ? "Today" : calendarDate(at, now, locale)}</span>
          </div>
        );
      },
      sortValue: (row) => row.sentAt ?? row.queuedAt,
    },
    {
      key: "to",
      header: "To",
      render: (row) => (
        <div className="flex max-w-60 flex-col">
          <span className="truncate" title={row.toAddress}>
            {row.toAddress || <span className="italic text-on-surface-muted">No address</span>}
          </span>
          {row.toName && <span className="truncate text-[12px] text-on-surface-muted">{row.toName}</span>}
        </div>
      ),
      sortValue: (row) => row.toAddress,
    },
    {
      key: "subject",
      header: "Subject",
      render: (row) => {
        const note = emailNote(row, locale);
        return (
          <div className="flex max-w-[26rem] flex-col whitespace-normal" data-testid="email-subject">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 rounded-sm border border-border px-1.5 text-[11.5px] font-medium leading-5 text-on-surface-muted">{EMAIL_KIND_LABELS[row.kind]}</span>
              <span className="truncate font-medium text-on-surface" title={row.subject}>
                {row.subject}
              </span>
            </span>
            {note && <span className={cn("text-[12px]", note.error ? "text-overdue" : "text-on-surface-muted")}>{note.text}</span>}
          </div>
        );
      },
      sortValue: (row) => row.subject,
    },
    {
      key: "record",
      header: "Record",
      render: (row) => {
        const href = emailRecordHref(row.entityType, row.entityId);
        if (!row.recordLabel) return <span className="text-on-surface-muted">—</span>;
        return href ? (
          <Link href={href} className="whitespace-nowrap text-primary hover:underline">
            {row.recordLabel}
          </Link>
        ) : (
          row.recordLabel
        );
      },
      sortValue: (row) => row.recordLabel ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge className={STATUS_CLASS[row.status]} data-testid="email-status">
          {EMAIL_LOG_STATUS_LABELS[row.status]}
        </Badge>
      ),
      sortValue: (row) => row.status,
    },
    {
      key: "attempts",
      header: "Attempts",
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-on-surface-muted">
          {row.attempts} of {row.maxAttempts}
        </span>
      ),
      sortValue: (row) => row.attempts,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <EmailRowActions email={row} onRetry={onRetry} onCancel={onCancel} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={emails}
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

/** Retry now and Cancel for a queued email; the record to open, where it can be sent again. */
function EmailRowActions({ email, onRetry, onCancel }: { email: EmailLogEntry; onRetry: (email: EmailLogEntry) => void; onCancel: (email: EmailLogEntry) => void }) {
  const router = useRouter();
  const href = emailRecordHref(email.entityType, email.entityId);
  const record = href && email.recordLabel;
  if (!email.canRetry && !email.canCancel && !record) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for the email to ${email.toAddress || "no address"}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {email.canRetry && (
          <DropdownMenuItem onSelect={() => onRetry(email)}>
            <MENU_ICONS.retry aria-hidden />
            Retry now
          </DropdownMenuItem>
        )}
        {record && (
          <DropdownMenuItem onSelect={() => router.push(href)}>
            <MENU_ICONS.open aria-hidden />
            Open {email.recordLabel}
          </DropdownMenuItem>
        )}
        {email.canCancel && (
          <>
            {(email.canRetry || record) && <DropdownMenuSeparator />}
            <DropdownMenuItem destructive onSelect={() => onCancel(email)}>
              <MENU_ICONS.cancel aria-hidden />
              Cancel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
