/**
 * US-TAX-11 (D-147) — why a line has no tax, so the Tax Summary and GSTR-1
 * report zero-rated, exempt and non-taxable supplies separately.
 */
export const SUPPLY_CLASSES = ["taxable", "zero_rated", "exempt", "non_taxable"] as const;
export type SupplyClass = (typeof SUPPLY_CLASSES)[number];

export const SUPPLY_CLASS_LABELS: Record<SupplyClass, string> = {
  taxable: "Taxable",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
  non_taxable: "Non-taxable (outside GST/VAT)",
};

const NO_TAX_MESSAGES: Partial<Record<SupplyClass, string>> = {
  exempt: "An exempt line has no tax. Change the supply type to Taxable to add tax.",
  non_taxable: "A non-taxable line has no tax. Change the supply type to Taxable to add tax.",
};

/** The message for an exempt or non-taxable line that has tax, else null. */
export function supplyClassTaxError(supplyClass: SupplyClass | null | undefined, taxPercent: number | string): string | null {
  return Number(taxPercent) > 0 && supplyClass ? (NO_TAX_MESSAGES[supplyClass] ?? null) : null;
}

/**
 * A line's supply class: a taxed line is taxable; an untaxed one keeps the
 * class it was given (from its catalogue item or the person), else
 * zero-rated. Call `supplyClassTaxError` first to refuse exempt lines with tax.
 */
export function lineSupplyClass(taxPercent: number | string, requested: SupplyClass | null | undefined): SupplyClass {
  if (Number(taxPercent) > 0) return "taxable";
  return requested ?? "zero_rated";
}
