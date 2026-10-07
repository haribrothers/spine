import { z } from "zod";
import { TAX_COUNTRIES } from "../tax/presets/types.ts";

/** US-DASH-25 — Settings › Tax › "Return period" (`settings.tax_profile.returnPeriod`, monthly by default). */
export const RETURN_PERIODS = ["monthly", "quarterly"] as const;
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];

/**
 * `settings.tax_profile` (D-145, D-146) — the tax country (US-TAX-09) and
 * the return period (US-DASH-25). Unknown keys are kept.
 */
export const taxProfileSchema = z
  .object({
    country: z.enum(TAX_COUNTRIES, { message: "Choose a country from the list." }).optional(),
    returnPeriod: z.enum(RETURN_PERIODS, { message: "Choose Monthly or Quarterly." }).optional(),
  })
  .passthrough();
export type TaxProfile = z.infer<typeof taxProfileSchema>;

/** US-TAX-09 — `PUT /org/tax/profile`: a country seeds its preset. */
export const putTaxProfileSchema = z.object({
  country: z.enum(TAX_COUNTRIES, { message: "Choose a country from the list." }),
});

/** What `PUT /org/tax/profile` returns: the profile and how many rates the preset added. */
export interface TaxProfileUpdate {
  profile: TaxProfile;
  added: number;
}
