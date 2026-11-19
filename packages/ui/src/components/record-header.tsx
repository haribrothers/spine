"use client";

import { Children } from "react";
import { cn } from "../lib/cn";
import { usePhone } from "../lib/use-phone";

export interface RecordAmount {
  /** What the figure is: "Balance due", "Total", "Contract". */
  label: string;
  /** The formatted amount: "$1,680.00". */
  value: string;
  /** A line under it: "45 days overdue · due 4 Oct". */
  note?: React.ReactNode;
  /** Overdue shows the amount and its note in the overdue colour; paid in the paid colour. */
  tone?: "default" | "overdue" | "paid";
}

export interface RecordHeaderProps {
  /** The number or name, the page's h1: "INV-0038". */
  title: React.ReactNode;
  /** Its status `Badge` (and any other badges: "Progress claim 2"). */
  badges?: React.ReactNode;
  /** A line under the title: a job's name. */
  subtitle?: React.ReactNode;
  /** The key amount, under the title on a phone only (from 768px up it's in the figures below). */
  amount?: RecordAmount;
  /** The contact, dates and where it came from, one line that wraps. */
  meta?: React.ReactNode;
  /** The record's actions, on the right from 768px up. */
  actions?: React.ReactNode;
  /** Anything else under the meta line (a note). */
  children?: React.ReactNode;
  className?: string;
}

const AMOUNT_TONE = { default: "text-on-surface", overdue: "text-overdue", paid: "text-paid" } as const;
const NOTE_TONE = { default: "text-on-surface-muted", overdue: "font-medium text-overdue", paid: "font-medium text-paid" } as const;

/**
 * US-OPS-58 (D-283) — the top of a record: its number or name and status, then (on a phone)
 * its key amount, then the contact, dates and where it came from; its actions on the right
 * from 768px up. Under 768px the back arrow is in the top bar, so there's no breadcrumb, and
 * the actions go to the `ActionBar` and the top bar's ⋯.
 */
export function RecordHeader({ title, badges, subtitle, amount, meta, actions, children, className }: RecordHeaderProps) {
  const tone = amount?.tone ?? "default";
  // Only rendered on a phone: from 768px up the amount is in the figures, and a hidden copy
  // would be a second match for anything looking for that amount on the page.
  const phone = usePhone();
  return (
    <div data-record-header="" className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:min-w-[18rem]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="min-w-0 break-words text-[24px] font-bold leading-tight tracking-tight text-on-surface">{title}</h1>
          {badges}
        </div>
        {subtitle}
        {amount && phone && (
          <div className="mb-1 mt-1.5 flex flex-col" data-record-amount="">
            <span className="text-[13px] text-on-surface-muted">{amount.label}</span>
            <span className={cn("text-[32px] font-bold leading-tight tracking-tight tabular-nums", AMOUNT_TONE[tone])}>{amount.value}</span>
            {amount.note && <span className={cn("text-[13px]", NOTE_TONE[tone])}>{amount.note}</span>}
          </div>
        )}
        {meta}
        {children}
      </div>
      {actions}
    </div>
  );
}

export interface RecordFiguresProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How many figures sit in a row from 768px up (the default is all of them, up to 5). */
  columns?: 1 | 2 | 3 | 4 | 5;
}

const MD_COLUMNS = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" } as const;

/**
 * US-OPS-58 (D-283) — a record's figures (an invoice's Total, Paid and Balance due; a job's
 * contract, billed, cost, margin and complete) in one box with lines between them: in a row
 * from 768px up, two per row on a phone, the last one the full width when it's on its own.
 * Each child is one figure; it gets the box's background.
 */
export function RecordFigures({ columns, className, children, ...props }: RecordFiguresProps) {
  const count = Children.toArray(children).filter(Boolean).length;
  const md = columns ?? (Math.min(5, Math.max(1, count)) as 1 | 2 | 3 | 4 | 5);
  return (
    <div
      data-record-figures=""
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border",
        MD_COLUMNS[md],
        "[&>*]:min-w-0 [&>*]:bg-surface max-md:[&>*:last-child:nth-child(odd)]:col-span-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
