"use client";

import { useEffect, useState } from "react";
import type { CatalogBundle } from "@spine/shared";
import type { PickerBundle } from "../components/line-item-picker";
import { apiClient } from "./api-client";

/** The line fields quote and invoice editors share. */
export interface BundleLineFields {
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPriceAmount: bigint;
  discountPercentage: number;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
}

/** US-QUO-26 — active bundles in the document's currency, for the line picker. */
export function useBundles(currency: string): { bundles: CatalogBundle[]; pickerBundles: PickerBundle[] } {
  const [bundles, setBundles] = useState<CatalogBundle[]>([]);
  useEffect(() => {
    apiClient
      .get<CatalogBundle[]>(`/catalog-bundles?currency=${encodeURIComponent(currency)}`)
      .then(setBundles)
      .catch(() => setBundles([]));
  }, [currency]);
  return {
    bundles,
    pickerBundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      totalAmount: BigInt(b.totalAmount),
      lineNames: b.lines.filter((l) => l.type === "item").map((l) => l.name),
    })),
  };
}

/**
 * The lines a bundle adds, in order, with the bundle's own prices and tax
 * (D-096). A line whose catalogue item is archived or gone is added as a
 * one-off line.
 */
export function bundleLines(bundle: CatalogBundle, activeItemIds: Set<string>): BundleLineFields[] {
  return bundle.lines.map((l) => ({
    type: l.type,
    catalogItemId: l.catalogItemId && activeItemIds.has(l.catalogItemId) ? l.catalogItemId : null,
    name: l.name,
    description: l.description ?? "",
    quantity: l.quantity,
    unitPriceAmount: BigInt(l.unitPriceAmount),
    discountPercentage: l.discountPercentage,
    taxRatePercentage: l.taxRatePercentage,
    taxRateId: l.taxRateId,
    taxGroupId: l.taxGroupId,
    isTaxInclusive: l.isTaxInclusive,
  }));
}
