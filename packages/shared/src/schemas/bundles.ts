import { z } from "zod";
import { uuidSchema } from "./common.ts";
import type { SupplyClass } from "../tax/supply-class.ts";

/** US-QUO-25 — the name a bundle needs, and how long it may be. */
export const BUNDLE_NAME_REQUIRED = "Give the bundle a name.";
export const BUNDLE_NAME_MAX = 120;

/** `POST /catalog-bundles` — saves a quote's lines as a bundle; the server copies them from the quote. */
export const createCatalogBundleSchema = z.object({
  name: z.string().trim().min(1, BUNDLE_NAME_REQUIRED).max(BUNDLE_NAME_MAX, `Keep the name under ${BUNDLE_NAME_MAX} characters.`),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional().nullable(),
  sourceQuoteId: uuidSchema,
});

/** `PUT /catalog-bundles/:id` — renames or re-describes a bundle; its lines don't change. */
export const updateCatalogBundleSchema = createCatalogBundleSchema.pick({ name: true, description: true }).partial();

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
