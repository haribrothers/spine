import { z } from "zod";
import { uuidSchema } from "./common.ts";

/** PRD FEAT-08 — a named, org-defined tax rate (S-08.1). `rate` is a plain decimal percentage (0-100), not money. */
export const createTaxRateSchema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().min(0).max(100),
  isCompound: z.boolean().optional(),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

/** S-08.3 — a named bundle of existing tax rates applied together on one line. */
export const createTaxGroupSchema = z.object({
  name: z.string().min(1),
  taxRateIds: z.array(uuidSchema).min(1),
});

export const updateTaxGroupSchema = createTaxGroupSchema.partial();
