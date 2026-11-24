import { z } from "zod";
import { uuidSchema } from "./common.ts";
import type { SupplyClass } from "../tax/supply-class.ts";

/** US-QUO-25 — the name a bundle needs, and how long it may be. */
export const BUNDLE_NAME_REQUIRED = "Give the bundle a name.";
export const BUNDLE_NAME_MAX = 120;

/** US-CAT-14 — a bundle made from catalogue items holds 1 to 50 of them. */
export const MAX_BUNDLE_ITEMS = 50;
export const BUNDLE_ONE_CURRENCY = "Choose items in one currency.";

const bundleBase = z.object({
  name: z.string().trim().min(1, BUNDLE_NAME_REQUIRED).max(BUNDLE_NAME_MAX, `Keep the name under ${BUNDLE_NAME_MAX} characters.`),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional().nullable(),
});

/**
 * `POST /catalog-bundles` — saves a quote's lines as a bundle (the server
 * copies them from the quote), or (US-CAT-14) catalogue items with a
 * quantity each, at their default price and tax. Exactly one of the two.
 */
export const createCatalogBundleSchema = bundleBase
  .extend({
    sourceQuoteId: uuidSchema.optional(),
    items: z
      .array(z.object({ catalogItemId: uuidSchema, quantity: z.coerce.number().positive("Enter a quantity above 0.").max(1_000_000) }))
      .min(1, "Choose at least one item.")
      .max(MAX_BUNDLE_ITEMS, `A bundle holds up to ${MAX_BUNDLE_ITEMS} items.`)
      .optional(),
  })
  .refine((v) => Boolean(v.sourceQuoteId) !== Boolean(v.items), { message: "Choose a quote or items for the bundle.", path: ["items"] });

/** `PUT /catalog-bundles/:id` — renames or re-describes a bundle; its lines don't change. */
export const updateCatalogBundleSchema = bundleBase.partial();

export type CreateCatalogBundleInput = z.infer<typeof createCatalogBundleSchema>;
export type UpdateCatalogBundleInput = z.infer<typeof updateCatalogBundleSchema>;

export interface CatalogBundleLine {
  id: string;
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  discountPercentage: number;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  /** US-TAX-11 — null on heading and text lines. */
  supplyClass: SupplyClass | null;
  /** US-TAX-14 */
  hsnSac: string | null;
}

export interface CatalogBundle {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  /** Minor units, as a string. */
  totalAmount: string;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  lines: CatalogBundleLine[];
}
