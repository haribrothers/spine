import { z } from "zod";

/** US-INV-16 — the "How customers can pay" block is at most this long. */
export const PAYMENT_INSTRUCTIONS_MAX = 600;
export const PAYMENT_INSTRUCTIONS_TOO_LONG = "Keep this under 600 characters.";

/**
 * The `business_profile` setting. Loose on purpose (`passthrough`): it only
 * guards the fields with rules, and keeps whatever else is stored.
 */
export const businessProfileSchema = z
  .object({
    name: z.string().optional(),
    logoUrl: z.string().optional(),
    address: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    paymentInstructions: z.string().max(PAYMENT_INSTRUCTIONS_MAX, PAYMENT_INSTRUCTIONS_TOO_LONG).optional(),
  })
  .passthrough();

export type BusinessProfile = z.infer<typeof businessProfileSchema>;
