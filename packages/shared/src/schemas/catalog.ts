import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";
import { SUPPLY_CLASSES } from "../tax/supply-class.ts";

/**
 * PRD F2 / S-02.1-S-02.4 — goods and services with a unit, default price and
 * default tax rate. `defaultPriceAmount` follows the same Money shape as
 * `createLeadSchema.valueAmount` (packages/shared/src/schemas/contacts.ts):
 * `z.coerce.bigint()`, since money is always bigint minor units per
 * CLAUDE.md, never a float.
 *
 * `defaultTaxRatePercentage` is a plain decimal number (0-100), not money —
 * it's a rate, pre-filled client-side from the org's single default tax rate
 * (`GET /org/tax/default-rate`) and then stored per item. There is no
 * `tax_rates` table to FK to yet (FEAT-08, later phase).
 *
 * NOTE on the `.partial()` pitfall documented in this file's CHANGELOG entry
 * for contacts.ts: `createCatalogItemSchema` intentionally has NO
 * `z.boolean().default(...)` field. If one is ever added, do not rely on a
 * shared `.default()` — `updateCatalogItemSchema = createCatalogItemSchema
 * .partial()` would silently un-default it (a `.partial()` field with a
 * `.default()` becomes fully optional-and-undefined-passthrough, not
 * "defaults to false when omitted," on `.parse()` of a partial update
 * payload). Handle any future boolean flag's default explicitly at the call
 * site instead, exactly as this codebase's own prior fix did.
 */
export const createCatalogItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  unit: z.string().min(1),
  category: z.string().optional().nullable(),
  defaultPriceAmount: z.coerce.bigint(),
  defaultPriceCurrency: currencyCodeSchema,
  /** Legacy fallback, kept for callers that don't yet pick a named rate. Superseded by defaultTaxRateId/defaultTaxGroupId (FEAT-08) when either is set. */
  defaultTaxRatePercentage: z.coerce.number().min(0).max(100).optional(),
  /** At most one of these two — enforced server-side, not by this schema. */
  defaultTaxRateId: uuidSchema.optional().nullable(),
  defaultTaxGroupId: uuidSchema.optional().nullable(),
  incomeAccountId: uuidSchema.optional().nullable(),
  expenseAccountId: uuidSchema.optional().nullable(),
  /** US-TAX-11 — copied to each line; an item with tax is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional(),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial();
