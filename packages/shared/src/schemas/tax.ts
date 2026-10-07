import { z } from "zod";
import { uuidSchema } from "./common.ts";
import { TAX_GROUP_SCOPES, TAX_TYPES } from "../tax/tax-types.ts";

/** PRD FEAT-08 — a named, org-defined tax rate (S-08.1). `rate` is a plain decimal percentage (0-100), not money. */
export const createTaxRateSchema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(100),
  isCompound: z.boolean().optional(),
  /** US-TAX-10 — CGST, SGST, IGST… (`other` when not given). */
  taxType: z.enum(TAX_TYPES).optional(),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

/** S-08.3 — a named bundle of existing tax rates applied together on one line. */
export const createTaxGroupSchema = z.object({
  name: z.string().min(1),
  taxRateIds: z.array(uuidSchema).min(1),
  /** US-TAX-10 — intra-state, inter-state or either; India's GST mixes set it from their rates. */
  scope: z.enum(TAX_GROUP_SCOPES).optional(),
});

export const updateTaxGroupSchema = createTaxGroupSchema.partial();
