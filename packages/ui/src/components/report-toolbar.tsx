"use client";

import { useId } from "react";
import { cn } from "../lib/cn";
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
  className?: string;
}

/**
 * The bar above every report: labelled 40px filters on the left, the
 * page's actions (Export, then any primary button) on the right, all
 * aligned to the bottom edge of the controls. Filters apply as they
 * change, so there's no Refresh button; `loading` says it's updating.
 */
export function ReportToolbar({ filters, actions, loading = false, className }: ReportToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)} data-print="hide" data-testid="report-toolbar">
      {filters}
      {loading && (
        <span className="flex h-10 items-center">
          <Spinner size="sm" label="Updating the report" />
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
