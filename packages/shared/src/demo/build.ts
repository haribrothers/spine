import { COUNTRY_PACKS } from "./countries.ts";
import { CONSTRUCTION } from "./industries/construction.ts";
import { INTERIOR_DESIGN } from "./industries/interior-design.ts";
import { IT_SERVICES } from "./industries/it-services.ts";
import { PROFESSIONAL_SERVICES } from "./industries/professional-services.ts";
import { TRADES } from "./industries/trades.ts";
import { riverstonePlan } from "./riverstone.ts";
import { localisedPlan, type IndustryPack } from "./scenario.ts";
import type { DemoCountry, DemoIndustry, DemoPlan } from "./types.ts";

export const INDUSTRY_PACKS: Record<DemoIndustry, IndustryPack> = {
  construction: CONSTRUCTION,
  interior_design: INTERIOR_DESIGN,
  trades: TRADES,
  it_services: IT_SERVICES,
  professional_services: PROFESSIONAL_SERVICES,
};

/** US-ONB-18 (D-192) — the demo business for a country and an industry. US construction is Riverstone Builders. */
export function buildDemoPlan(country: DemoCountry, industry: DemoIndustry): DemoPlan {
  if (country === "US" && industry === "construction") return riverstonePlan();
  return localisedPlan(COUNTRY_PACKS[country], INDUSTRY_PACKS[industry]);
}

/** The name of the business a demo loads ("Tarang Interiors"). */
export function demoBusinessName(country: DemoCountry, industry: DemoIndustry): string {
  return INDUSTRY_PACKS[industry].businessNames[country];
}

const ZONES: [RegExp, DemoCountry][] = [
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
  [/^Europe\/(London|Belfast)$/, "GB"],
  [/^Australia\//, "AU"],
  [/^Pacific\/(Auckland|Chatham)$/, "NZ"],
  [/^Asia\/Dubai$/, "AE"],
  [/^Asia\/Riyadh$/, "SA"],
];

/** The picker's first guess from the browser's time zone; anything not listed is the United States. */
export function guessDemoCountry(timeZone: string | null | undefined): DemoCountry {
  return ZONES.find(([zone]) => zone.test(timeZone ?? ""))?.[1] ?? "US";
}
