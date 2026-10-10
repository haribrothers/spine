import { describe, expect, it } from "vitest";
import { catalogStats, categoriesNote, filterCatalog, isMissingTax, parseCatalogState } from "../app/(app)/catalog/catalog-list-state";
import { item } from "./catalog-fixtures";

describe("US-CAT-10 · see what needs setting up, and filter to it", () => {
  const taxed = { defaultTaxRateId: "r1", defaultTaxRatePercentage: 18, supplyClass: "taxable" as const };

  it("counts a taxable item with no tax as missing; zero-rated, exempt and non-taxable don't count for a GST business", () => {
    expect(isMissingTax(item({ supplyClass: "taxable" }), true)).toBe(true);
    expect(isMissingTax(item({ supplyClass: "zero_rated" }), true)).toBe(false);
    expect(isMissingTax(item({ supplyClass: "exempt" }), true)).toBe(false);
    expect(isMissingTax(item({ supplyClass: "non_taxable" }), true)).toBe(false);
    expect(isMissingTax(item(taxed), true)).toBe(false);
  });

  it("elsewhere, any untaxed item is missing its tax unless it's exempt or non-taxable", () => {
    expect(isMissingTax(item({ supplyClass: "zero_rated" }), false)).toBe(true);
    expect(isMissingTax(item({ supplyClass: "exempt" }), false)).toBe(false);
    expect(isMissingTax(item(taxed), false)).toBe(false);
  });

  it("counts active items only, whatever the filters, and names the categories", () => {
    const all = [
      item({ name: "Cement", category: "Materials", ...taxed, incomeAccountId: "a1" }),
      item({ name: "Painting", category: "Finishes" }),
      item({ name: "Tiling", category: "Finishes", ...taxed }),
      item({ name: "Old", category: "Labour", archivedAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(catalogStats(all, false)).toEqual({ total: 3, categories: ["Finishes", "Materials"], missingTax: 1, noIncomeAccount: 2 });
    expect(categoriesNote(["Equipment", "Finishes", "Labour", "Materials"])).toBe("Equipment, Finishes and 2 more");
    expect(categoriesNote(["Labour"])).toBe("Labour");
    expect(categoriesNote([])).toBe("None yet");

    const base = parseCatalogState(new URLSearchParams(""));
    expect(filterCatalog(all, { ...base, setup: "tax" }, false).map((i) => i.name)).toEqual(["Painting"]);
    expect(filterCatalog(all, { ...base, setup: "account" }, false).map((i) => i.name)).toEqual(["Painting", "Tiling"]);
  });
});
