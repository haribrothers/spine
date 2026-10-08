import { INDIA_PRESET } from "./india.ts";
import { AUSTRALIA_PRESET, NEW_ZEALAND_PRESET, SAUDI_ARABIA_PRESET, UAE_PRESET, UK_PRESET } from "./others.ts";
import type { TaxCountry, TaxPreset } from "./types.ts";

export * from "./types.ts";

/** US-TAX-09 — in the order the setup wizard lists them. */
export const TAX_PRESETS: readonly TaxPreset[] = [INDIA_PRESET, UK_PRESET, AUSTRALIA_PRESET, NEW_ZEALAND_PRESET, UAE_PRESET, SAUDI_ARABIA_PRESET];

export const OTHER_COUNTRY_LABEL = "Another country — I'll add my own rates";

export function taxPreset(country: TaxCountry): TaxPreset | null {
  return TAX_PRESETS.find((p) => p.country === country) ?? null;
}

export function taxCountryLabel(country: TaxCountry): string {
  return taxPreset(country)?.label ?? OTHER_COUNTRY_LABEL;
}
