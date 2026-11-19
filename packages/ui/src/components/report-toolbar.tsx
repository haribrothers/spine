"use client";

import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { usePhone } from "../lib/use-phone";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Label } from "./label";
import { Spinner } from "./spinner";

export interface ReportToolbarProps {
  /** Labelled controls on the left — `ReportFilter`s and `ReportFilterCheckbox`es, in the order From, To, Compare with, Basis, then the report's own. */
  filters?: React.ReactNode;
  /** The page's actions on the right: Export, then the one primary button last. */
  actions?: React.ReactNode;
  /** Shows a spinner after the filters while the report reloads. */
  loading?: boolean;
  /** US-RPT-41: what's chosen, one line on a phone ("Jan 1 – Nov 18, 2026 · Accrual · No comparison"); it opens the filters in a sheet. */
  summary?: string;
  className?: string;
}

/**
 * The bar above every report: labelled 40px filters on the left, the
 * page's actions (Export, then any primary button) on the right, all
 * aligned to the bottom edge of the controls. Filters apply as they
 * change, so there's no Refresh button; `loading` says it's updating.
 */
export function ReportToolbar({ filters, actions, loading = false, summary, className }: ReportToolbarProps) {
  const t = useT();
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  // US-RPT-41: on a phone the filters are one line saying what's chosen, which opens them in a sheet.
  if (phone) {
    return (
      <div className={cn("-mx-4 border-b border-border", className)} data-print="hide" data-testid="report-toolbar">
        {filters ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            data-testid="report-filter-summary"
          >
            <SlidersHorizontal size={18} aria-hidden className="shrink-0 text-on-surface-muted" />
            <span className="min-w-0 flex-1 truncate">
              <span className="sr-only">{t("ui.reportToolbar.filters")}: </span>
              {summary ?? t("ui.reportToolbar.filters")}
            </span>
            {loading ? <Spinner size="sm" label={t("ui.reportToolbar.updating")} /> : <ChevronRight size={18} aria-hidden className="shrink-0 text-on-surface-muted" />}
          </button>
        ) : null}
        {actions}
        {filters ? (
          <BottomSheet
            open={open}
            onOpenChange={setOpen}
            title={t("ui.reportToolbar.sheetTitle")}
            footer={
              <Button className="flex-1" onClick={() => setOpen(false)}>
                {t("ui.reportToolbar.show")}
              </Button>
            }
          >
            <div className="flex flex-col gap-4 pt-1 [&>*]:w-full [&_button[role=combobox]]:w-full">{filters}</div>
          </BottomSheet>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)} data-print="hide" data-testid="report-toolbar">
      {filters}
      {loading && (
        <span className="flex h-10 items-center">
          <Spinner size="sm" label={t("ui.reportToolbar.updating")} />
        </span>
      )}
      {actions && <div className="ml-auto flex flex-wrap items-end gap-3">{actions}</div>}
    </div>
  );
}

export interface ReportFilterProps {
  label: string;
  /** The control. A function receives the label's id for `aria-labelledby` (Select triggers, MultiSelect). */
  children: React.ReactNode | ((labelId: string) => React.ReactNode);
  className?: string;
}

/** One labelled control in a `ReportToolbar`: the label above, the 40px control below. */
export function ReportFilter({ label, children, className }: ReportFilterProps) {
  const labelId = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label id={labelId}>{label}</Label>
      {typeof children === "function" ? children(labelId) : children}
    </div>
  );
}

export interface ReportFilterCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A yes/no option in a `ReportToolbar` (e.g. "Hide accounts with no balance"), 40px tall so it lines up with the controls. */
export function ReportFilterCheckbox({ label, checked, onCheckedChange }: ReportFilterCheckboxProps) {
  return (
    <label className="flex h-10 items-center gap-2 text-[14px] text-on-surface">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      {label}
    </label>
  );
}
