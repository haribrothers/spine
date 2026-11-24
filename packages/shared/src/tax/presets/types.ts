import type { TaxGroupScope, TaxType } from "../tax-types.ts";

/** US-TAX-09 — the countries with a tax preset (D-145); `other` starts with no rates. */
export const TAX_COUNTRIES = ["IN", "GB", "AU", "NZ", "AE", "SA", "other"] as const;
export type TaxCountry = (typeof TAX_COUNTRIES)[number];

export interface PresetRate {
  name: string;
  /** Percentage, e.g. 9 for 9%. */
  rate: number;
  taxType: TaxType;
  /** D-182 — what a 0% rate means for its lines. */
  supplyClass?: "zero_rated" | "exempt";
  /** Created archived: the law no longer uses it. */
  archived?: boolean;
}

export interface PresetGroup {
  name: string;
  /** Names of rates in the same preset. */
  rates: string[];
  scope: TaxGroupScope;
  archived?: boolean;
}

/**
 * A country's tax setup as data only (D-145). Seeding adds what's missing
 * and never edits or deletes an existing rate.
 */
export interface TaxPreset {
  country: Exclude<TaxCountry, "other">;
  label: string;
  /** One line under the choice in the setup wizard. */
  description: string;
  rates: PresetRate[];
  groups: PresetGroup[];
  /** The invoice title the preset sets, when the country has one. */
  invoiceTitle?: string;
}
