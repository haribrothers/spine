"use client";

import { cn } from "../lib/cn";

export interface ListRowProps {
  /** The record's number or name. When it holds a link, the whole row opens it. */
  title: React.ReactNode;
  /** Its status, with its text (a `Badge`). */
  badge?: React.ReactNode;
  /** The second line: contact and date, or the job. */
  subtitle?: React.ReactNode;
  /** The amount or figure on the right; never truncated. */
  trailing?: React.ReactNode;
  /** A line under the amount: "Due 25 Nov", "6 days late". */
  trailingSub?: React.ReactNode;
  /** Before the text: an icon tile, an avatar, or Select mode's checkbox. */
  leading?: React.ReactNode;
  /** After the amount: the row's ⋯ (an action sheet) or a button such as Send reminder. */
  action?: React.ReactNode;
  /** Highlights the row (chosen in Select mode). */
  selected?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * US-OPS-56 (D-283) — one record as a two-line row on a phone: title and status on the
 * first line, a subtitle on the second, the amount on the right, then its ⋯. A link in the
 * title stretches over the whole row, so tapping anywhere opens the record; the ⋯ and any
 * button sit above it as their own 44px targets. Long text truncates; the amount doesn't.
 */
export function ListRow({ title, badge, subtitle, trailing, trailingSub, leading, action, selected = false, className, "data-testid": testId }: ListRowProps) {
  return (
    <li
      data-testid={testId}
      data-list-row=""
      className={cn(
        "relative flex min-h-16 items-center gap-3 border-b border-border py-2.5 pl-4 last:border-b-0",
        action ? "pr-1" : "pr-4",
        selected && "bg-info-bg",
        // The title's link covers the row; the leading checkbox and the action stay on top of it.
        "[&_[data-list-row-title]_a]:after:absolute [&_[data-list-row-title]_a]:after:inset-0 [&_[data-list-row-title]_a]:after:content-['']",
        className,
      )}
    >
      {leading ? <span className="relative z-10 flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span data-list-row-title="" className="min-w-0 truncate text-[15px] font-semibold leading-snug text-on-surface">
            {title}
          </span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </span>
        {subtitle ? <span className="truncate text-[13px] text-on-surface-muted">{subtitle}</span> : null}
      </span>
      {trailing || trailingSub ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {trailing ? <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-on-surface">{trailing}</span> : null}
          {trailingSub ? <span className="whitespace-nowrap text-[12px] font-medium text-on-surface-muted">{trailingSub}</span> : null}
        </span>
      ) : null}
      {action ? <span className="relative z-10 flex shrink-0 items-center">{action}</span> : null}
    </li>
  );
}

/** A placeholder row of the same height while a list loads. */
export function ListRowSkeleton() {
  return (
    <li aria-hidden className="flex min-h-16 items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-3 w-2/5 rounded-sm bg-neutral-100 motion-safe:animate-pulse" />
        <span className="h-2.5 w-3/5 rounded-sm bg-neutral-100 motion-safe:animate-pulse" />
      </span>
      <span className="h-3 w-16 rounded-sm bg-neutral-100 motion-safe:animate-pulse" />
    </li>
  );
}
