"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";

export interface FilterChip {
  key: string;
  /** What the filter is: "Status: Overdue". */
  label: string;
  onRemove: () => void;
}

export interface FilterSheetProps {
  /** The page's search field; on a phone it shares the row with Filters. */
  search?: React.ReactNode;
  /** The filters that are on, one chip each with × on a phone. */
  chips?: FilterChip[];
  /** Clears every filter (Clear all). */
  onClearAll?: () => void;
  /** The sheet's button: "Show 3 invoices". Defaults to "Show results". */
  showLabel?: string;
  /** The filter controls (and sort), as they are on the desktop. */
  children: React.ReactNode;
  /** The desktop row's own layout. */
  className?: string;
}

/**
 * US-OPS-57 (D-283) — a list's filters. From 768px up the controls are inline, as they were.
 * Under 768px there's one row — the search and a Filters button showing how many filters are
 * on — then a chip for each filter that's on, with × to remove it; Filters opens a bottom sheet
 * with every filter and the sort, one under another, with Clear all and Show results.
 */
export function FilterSheet({ search, chips = [], onClearAll, showLabel, children, className }: FilterSheetProps) {
  const t = useT();
  const phone = usePhone();
  const [open, setOpen] = useState(false);

  if (!phone) {
    return (
      <div className={className}>
        {search}
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-testid="filter-sheet-row">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 [&>*]:w-full">{search}</div>
        <Button variant="secondary" className="h-11 shrink-0" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <SlidersHorizontal aria-hidden />
          {t("ui.filterSheet.filters")}
          {chips.length > 0 ? (
            <span className="min-w-5 rounded-full bg-primary px-1.5 text-[12px] font-bold leading-5 text-on-primary" aria-label={t("ui.filterSheet.on", { count: chips.length })}>
              {chips.length}
            </span>
          ) : null}
        </Button>
      </div>
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t("ui.filterSheet.onLabel")}>
          {chips.map((chip) => (
            <li key={chip.key} className="inline-flex h-11 items-center gap-0.5 rounded-full border border-primary bg-info-bg pl-3 text-[13px] font-medium text-primary">
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={t("ui.filterSheet.remove", { filter: chip.label })}
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t("ui.filterSheet.filters")}
        data-testid="filter-sheet"
        footer={
          <>
            {onClearAll ? (
              <Button variant="secondary" className="h-12 flex-1" onClick={onClearAll} disabled={chips.length === 0}>
                {t("ui.filterSheet.clearAll")}
              </Button>
            ) : null}
            <Button className="h-12 flex-[2]" onClick={() => setOpen(false)}>
              {showLabel ?? t("ui.filterSheet.show")}
            </Button>
          </>
        }
      >
        {/* Each control the full width, one under another. */}
        <div className={cn("flex flex-col gap-4 pt-1 [&>*]:w-full [&_[role=combobox]]:w-full")}>{children}</div>
      </BottomSheet>
    </div>
  );
}
