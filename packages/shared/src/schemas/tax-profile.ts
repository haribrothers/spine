import { z } from "zod";
import { TAX_COUNTRIES } from "../tax/presets/types.ts";
import { GSTIN_INVALID_MESSAGE, gstState, gstinError, normaliseGstin } from "../tax/gst.ts";

/** US-TAX-13 — a default tax: one rate or one group. */
export const taxChoiceSchema = z.object({ taxRateId: z.string().uuid().nullable(), taxGroupId: z.string().uuid().nullable() });

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
    /** US-TAX-12 — the GSTIN in India. */
    registrationNumber: z.string().nullable().optional(),
    legalName: z.string().nullable().optional(),
    tradeName: z.string().nullable().optional(),
    /** Two-digit GST state code. */
    stateCode: z.string().nullable().optional(),
    /** YYYY-MM-DD. */
    registeredOn: z.string().nullable().optional(),
    /** US-TAX-13 — Settings › Tax › "Default tax preference" for new catalogue items. */
    defaultIntraTax: taxChoiceSchema.nullable().optional(),
    defaultInterTax: taxChoiceSchema.nullable().optional(),
  })
  .passthrough();
export type TaxProfile = z.infer<typeof taxProfileSchema>;

/**
 * `PUT /org/tax/profile`: a country seeds its preset (US-TAX-09); the GST
 * registration is checked — format, check character and state (US-TAX-12).
 * Fields left out are kept.
 */
export const putTaxProfileSchema = z
  .object({
    country: z.enum(TAX_COUNTRIES, { message: "Choose a country from the list." }).optional(),
    registrationNumber: z
      .string()
      .transform(normaliseGstin)
      .refine((v) => v === "" || gstinError(v) === null, GSTIN_INVALID_MESSAGE)
      .nullable()
      .optional(),
    legalName: z.string().trim().max(200).nullable().optional(),
    tradeName: z.string().trim().max(200).nullable().optional(),
    stateCode: z
      .string()
      .refine((v) => gstState(v) !== null, "Choose a state from the list.")
      .nullable()
      .optional(),
    registeredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date as YYYY-MM-DD.").nullable().optional(),
    returnPeriod: z.enum(RETURN_PERIODS, { message: "Choose Monthly or Quarterly." }).optional(),
    defaultIntraTax: taxChoiceSchema.nullable().optional(),
    defaultInterTax: taxChoiceSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // The GSTIN's first two digits must be the state chosen with it.
    if (v.registrationNumber && v.stateCode) {
      const message = gstinError(v.registrationNumber, v.stateCode);
      if (message) ctx.addIssue({ code: "custom", path: ["registrationNumber"], message });
    }
  });
export type PutTaxProfileInput = z.infer<typeof putTaxProfileSchema>;

/** What `PUT /org/tax/profile` returns: the profile and how many rates the preset added. */
export interface TaxProfileUpdate {
  profile: TaxProfile;
  added: number;
}
