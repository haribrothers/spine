import type { CatalogItem } from "../app/(app)/catalog/types";

/** A catalogue item for the US-CAT-10 to 15 tests. */
export const item = (over: Partial<CatalogItem>): CatalogItem =>
  ({
    id: over.name ?? "x",
    name: "x",
    description: null,
    unit: "each",
    category: null,
    defaultPriceAmount: "10000",
    defaultPriceCurrency: "USD",
    defaultTaxRatePercentage: 0,
    defaultTaxRateId: null,
    defaultTaxGroupId: null,
    hsnSac: null,
    supplyClass: "zero_rated",
    incomeAccountId: null,
    expenseAccountId: null,
    createdByUserId: null,
    archivedAt: null,
    ...over,
  }) as CatalogItem;
