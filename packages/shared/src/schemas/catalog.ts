import { z } from "zod";
import { currencyCodeSchema, hsnSacSchema, uuidSchema } from "./common.ts";
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
  /** US-TAX-13 — the item's inter-state tax (e.g. IGST 18%); the default tax above is its intra-state tax. At most one. */
  interTaxRateId: uuidSchema.optional().nullable(),
  interTaxGroupId: uuidSchema.optional().nullable(),
  /** US-TAX-14 — HSN (goods) or SAC (services) code, copied to each line. */
  hsnSac: hsnSacSchema.optional().nullable(),
  /** US-TAX-11 — copied to each line; an item with tax is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional(),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial();

/** US-CAT-12 — how many items one bulk change may touch. */
export const MAX_CATALOG_BULK = 200;

/**
 * US-CAT-12 (D-213) — `POST /catalog-items/bulk`: archive, restore or
 * change several items at once, all or nothing. `changes` (for "update")
 * sets a category, the intra-state tax (a rate, a group, or neither for no
 * tax) or the income account; a key left out isn't changed.
 */
export const bulkCatalogItemsSchema = z
  .object({
    ids: z.array(uuidSchema).min(1, "Choose at least one item.").max(MAX_CATALOG_BULK, `Change up to ${MAX_CATALOG_BULK} items at a time.`),
    action: z.enum(["update", "archive", "restore"]),
    changes: z
      .object({
        category: z.string().trim().max(120).optional().nullable(),
        defaultTaxRateId: uuidSchema.optional().nullable(),
        defaultTaxGroupId: uuidSchema.optional().nullable(),
        incomeAccountId: uuidSchema.optional().nullable(),
        /** US-TAX-13 — a GST business's inter-state tax, set alongside the default (intra-state) tax. */
        interTaxRateId: uuidSchema.optional().nullable(),
        interTaxGroupId: uuidSchema.optional().nullable(),
      })
      .optional(),
  })
  .refine((v) => v.action !== "update" || (v.changes && Object.keys(v.changes).length > 0), { message: "Choose what to change.", path: ["changes"] });
export type BulkCatalogItemsInput = z.infer<typeof bulkCatalogItemsSchema>;

/** US-CAT-15 — `GET /catalog-items/:id/usage`. */
export interface CatalogItemUsage {
  quotes: number;
  invoices: number;
  /** When a quote with a line from the item was last created; null if never. */
  lastQuotedAt: string | null;
}

/** The message when some selected items can't be changed (US-CAT-12). */
export function bulkRefusedMessage(count: number): string {
  return `You can't change ${count} of these items. Unselect them and try again.`;
}
