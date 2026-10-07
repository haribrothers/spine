"use client";

import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spine/ui";
import { SUPPLY_CLASSES, SUPPLY_CLASS_LABELS, supplyClassTaxError, type SupplyClass } from "@spine/shared";

/** The rate a line's chosen taxes add up to, for deciding whether it's taxed. */
export function lineTaxPercent(rates: readonly { percent: number | string }[]): number {
  return rates.reduce((sum, r) => sum + Number(r.percent), 0);
}

/**
 * US-TAX-11 — keeps a line's supply type in step with its tax: a line that
 * gains tax becomes taxable; one that loses it takes its item's type, else
 * zero-rated. Exempt and non-taxable stay put so the conflict shows.
 */
export function supplyClassForTax(current: SupplyClass | null, taxPercent: number, itemClass?: SupplyClass | null): SupplyClass {
  if (taxPercent > 0) return current === "exempt" || current === "non_taxable" ? current : "taxable";
  if (current && current !== "taxable") return current;
  return itemClass && itemClass !== "taxable" ? itemClass : "zero_rated";
}

/**
 * Applies a line edit and, when it changed the tax or the catalogue item,
 * moves the supply type with it (unless the edit set the supply type itself).
 */
export function withSupplyClass<L extends { type: string; catalogItemId: string | null; supplyClass: SupplyClass | null }>(
  line: L,
  patch: Partial<L>,
  taxPercent: number,
  item: { supplyClass: SupplyClass } | undefined,
): L {
  if (line.type !== "item" || "supplyClass" in patch) return line;
  const pickedItem = "catalogItemId" in patch && item;
  if (!pickedItem && !("taxRateId" in patch || "taxGroupId" in patch || "taxRatePercentage" in patch)) return line;
  return { ...line, supplyClass: supplyClassForTax(pickedItem ? item.supplyClass : line.supplyClass, taxPercent, item?.supplyClass) };
}

/** Shown when a line has no tax, or when its type says it shouldn't. */
export function showsSupplyType(supplyClass: SupplyClass | null, taxPercent: number): boolean {
  return taxPercent === 0 || (supplyClass !== null && supplyClass !== "taxable");
}

/** US-TAX-11 — "Supply type" on a document line or catalogue item, with the exempt-with-tax message. */
export function SupplyTypeField({
  value,
  taxPercent,
  onChange,
  label = "Supply type",
  labelClassName = "text-[11px] font-medium text-on-surface-muted",
}: {
  value: SupplyClass | null;
  taxPercent: number;
  onChange: (value: SupplyClass) => void;
  label?: string;
  labelClassName?: string;
}) {
  const id = useId();
  const error = supplyClassTaxError(value, taxPercent);
  return (
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className={labelClassName}>
        {label}
      </span>
      <Select value={value ?? "zero_rated"} onValueChange={(v) => onChange(v as SupplyClass)}>
        <SelectTrigger aria-labelledby={`${id}-label`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPLY_CLASSES.map((c) => (
            <SelectItem key={c} value={c}>
              {SUPPLY_CLASS_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-overdue">
          {error}
        </p>
      )}
    </div>
  );
}
