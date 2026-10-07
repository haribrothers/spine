import { gstStateLabel, type GstTreatment } from "./gst.ts";

/**
 * US-TAX-13 (D-146) — which GST applies: the business's own state (CGST +
 * SGST), another state or an SEZ (IGST), or an export (IGST, D-146; Q-18).
 */
export const SUPPLY_TYPES = ["intra", "inter", "export"] as const;
export type SupplyType = (typeof SUPPLY_TYPES)[number];

export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  intra: "Intra-state",
  inter: "Inter-state",
  export: "Export",
};

/** The place of supply for a customer outside India (GSTR-1's "Other countries"). */
export const POS_OTHER_COUNTRIES = "96";

export function placeOfSupplyLabel(code: string | null | undefined): string {
  return code === POS_OTHER_COUNTRIES ? `Other countries (${POS_OTHER_COUNTRIES})` : gstStateLabel(code);
}

/**
 * The supply type for a document: null without a GST state or a place of
 * supply. A sale to an overseas customer is an export; a purchase from one
 * is inter-state, like a sale to an SEZ unit.
 */
export function supplyTypeFor(input: {
  businessState: string | null | undefined;
  placeOfSupply: string | null | undefined;
  treatment?: GstTreatment | null;
  direction?: "sale" | "purchase";
}): SupplyType | null {
  const { businessState, placeOfSupply, treatment, direction = "sale" } = input;
  if (!businessState || !placeOfSupply) return null;
  if (treatment === "overseas" || placeOfSupply === POS_OTHER_COUNTRIES) return direction === "sale" ? "export" : "inter";
  if (treatment === "sez") return "inter";
  return placeOfSupply === businessState ? "intra" : "inter";
}

/** Where the place of supply came from, for the hint under the field. */
export type PlaceOfSupplySource = "site" | "shipping" | "billing" | "contact" | "overseas";

/**
 * A contact's default place of supply (D-146): an overseas customer is
 * "Other countries"; otherwise the site or shipping address's state, else
 * billing, else the contact's own state.
 */
export function placeOfSupplyFor(contact: {
  gstTreatment?: GstTreatment | null;
  stateCode?: string | null;
  addresses?: readonly { type: string; stateCode?: string | null; isPrimary?: boolean }[];
}): { code: string; source: PlaceOfSupplySource } | null {
  if (contact.gstTreatment === "overseas") return { code: POS_OTHER_COUNTRIES, source: "overseas" };
  for (const type of ["site", "shipping", "billing"] as const) {
    const matches = (contact.addresses ?? []).filter((a) => a.type === type && a.stateCode);
    const address = matches.find((a) => a.isPrimary) ?? matches[0];
    if (address?.stateCode) return { code: address.stateCode, source: type };
  }
  return contact.stateCode ? { code: contact.stateCode, source: "contact" } : null;
}

/** A line's or item's chosen tax: one rate or one group, or neither. */
export interface TaxChoice {
  taxRateId: string | null;
  taxGroupId: string | null;
}

/** A catalogue item's taxes: its default (intra-state) and its inter-state counterpart. */
export interface ItemTaxes {
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  interTaxRateId?: string | null;
  interTaxGroupId?: string | null;
}

/** D-181 — how the business exports: with IGST (the default) or under LUT, zero-rated with no IGST. */
export interface ExportOptions {
  exportUnderLut?: boolean;
}

/** The tax a supply type calls for: intra-state, inter-state, or none (an export under LUT). */
function taxSide(supplyType: SupplyType | null, options: ExportOptions): "intra" | "inter" | "none" {
  if (supplyType === "export") return options.exportUnderLut ? "none" : "inter";
  return supplyType === "inter" ? "inter" : "intra";
}

/**
 * The tax an item brings to a line: its inter-state tax for an inter-state
 * sale or an export with IGST (when it has one), no tax for an export under
 * LUT (D-181), else its default.
 */
export function itemTaxFor(item: ItemTaxes, supplyType: SupplyType | null, options: ExportOptions = {}): TaxChoice {
  const side = taxSide(supplyType, options);
  if (side === "none") return { taxRateId: null, taxGroupId: null };
  if (side === "inter" && (item.interTaxRateId || item.interTaxGroupId)) return { taxRateId: item.interTaxRateId ?? null, taxGroupId: item.interTaxGroupId ?? null };
  return { taxRateId: item.defaultTaxRateId, taxGroupId: item.defaultTaxGroupId };
}

function sameTax(a: TaxChoice, b: TaxChoice): boolean {
  return (a.taxRateId ?? null) === (b.taxRateId ?? null) && (a.taxGroupId ?? null) === (b.taxGroupId ?? null);
}

/**
 * US-TAX-13 — when a draft's place of supply moves to a supply type that
 * calls for other tax (intra-state, inter-state, or none for an export
 * under LUT), lines still on their item's tax switch to the item's other
 * tax; lines whose tax was changed by hand (or that have no item) keep it
 * and are flagged so the person checks them. A switched line's supply
 * class follows: no tax makes a taxable line zero-rated, tax makes a
 * zero-rated one taxable.
 */
export function switchLineTaxes<L extends TaxChoice & { key: string; type: string; catalogItemId: string | null; supplyClass?: string | null }>(
  lines: readonly L[],
  items: readonly (ItemTaxes & { id: string })[],
  from: SupplyType | null,
  to: SupplyType | null,
  options: ExportOptions = {},
): { lines: L[]; switched: number; flagged: string[] } {
  if (taxSide(from, options) === taxSide(to, options)) return { lines: [...lines], switched: 0, flagged: [] };
  let switched = 0;
  const flagged: string[] = [];
  const next = lines.map((line) => {
    if (line.type !== "item") return line;
    const item = line.catalogItemId ? items.find((i) => i.id === line.catalogItemId) : undefined;
    const hasTax = Boolean(line.taxRateId || line.taxGroupId);
    if (!item) {
      if (hasTax) flagged.push(line.key);
      return line;
    }
    const before = itemTaxFor(item, from, options);
    const after = itemTaxFor(item, to, options);
    if (sameTax(line, before)) {
      if (sameTax(before, after)) return line;
      switched += 1;
      const taxed = Boolean(after.taxRateId || after.taxGroupId);
      const supplyClass = line.supplyClass === undefined ? {} : { supplyClass: !taxed && line.supplyClass === "taxable" ? "zero_rated" : taxed && line.supplyClass === "zero_rated" ? "taxable" : line.supplyClass };
      return { ...line, ...after, ...supplyClass };
    }
    if (!sameTax(line, after)) flagged.push(line.key);
    return line;
  });
  return { lines: next, switched, flagged };
}
