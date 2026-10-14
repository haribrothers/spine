"use client";

import Link from "next/link";
import { cn } from "@spine/ui";

export interface TrioFigure {
  label: string;
  value: string;
  /** Extra classes for the figure, e.g. its colour. */
  className?: string;
  href?: string;
  "aria-label"?: string;
}

/**
 * US-DASH-28 (D-209) — three figures side by side when they fit, and
 * stacked, each with its label, when they don't (Payables, Tax this
 * period), so big amounts never overlap.
 */
export function FigureTrio({ figures, className }: { figures: TrioFigure[]; className?: string }) {
  return (
    <div className="@container">
      <div className={cn("grid grid-cols-1 divide-y divide-border rounded-md border border-border @[30rem]:grid-cols-3 @[30rem]:divide-x @[30rem]:divide-y-0", className)} data-testid="figure-trio">
        {figures.map((f) => {
          const body = (
            <>
              <span className="text-[12px] text-on-surface-muted @[30rem]:block">{f.label}</span>
              <span className={cn("whitespace-nowrap text-[16px] font-semibold tabular-nums text-on-surface @[30rem]:mt-0.5 @[30rem]:block @[30rem]:text-[18px]", f.className)}>{f.value}</span>
            </>
          );
          const cell = "flex items-baseline justify-between gap-3 px-3 py-2.5 @[30rem]:block @[30rem]:p-3";
          return f.href ? (
            <Link key={f.label} href={f.href} className={cn(cell, "hover:bg-surface-sunken")} aria-label={f["aria-label"]}>
              {body}
            </Link>
          ) : (
            <div key={f.label} className={cell}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
