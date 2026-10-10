import { describe, expect, it } from "vitest";
import { catalogQuery, filterCatalog, hasCatalogFilters, parseCatalogState, priceLabel } from "../app/(app)/catalog/catalog-list-state";
import { formatMoney } from "../lib/money";
import { item } from "./catalog-fixtures";

describe("US-CAT-13 · the catalogue list in the address", () => {
  it("reads every filter, sort and page, and writes back only what isn't the default", () => {
    const query = "q=tile&status=active&status=archived&category=Labour&category=Finishes&min=100&max=5000&setup=tax&sort=defaultPrice.desc&page=2";
    const state = parseCatalogState(new URLSearchParams(query));
    expect(state).toEqual({
      q: "tile",
      status: ["active", "archived"],
      categories: ["Labour", "Finishes"],
      min: "100",
      max: "5000",
      setup: "tax",
      sort: { key: "defaultPrice", direction: "desc" },
      page: 2,
    });
    expect(catalogQuery(state)).toBe(query);
    expect(catalogQuery(parseCatalogState(new URLSearchParams("")))).toBe("");
    expect(parseCatalogState(new URLSearchParams("setup=nope&sort=name.sideways&page=-1"))).toMatchObject({ setup: "", sort: null, page: 1 });
    expect(hasCatalogFilters(parseCatalogState(new URLSearchParams("sort=name.asc&page=3")))).toBe(false);
    expect(hasCatalogFilters(parseCatalogState(new URLSearchParams("category=Labour")))).toBe(true);
  });

  it("searches name, description, category, unit and HSN/SAC, and filters by price in each item's currency", () => {
    const all = [
      item({ name: "Cement", description: "50 kg bag", category: "Materials", hsnSac: "2523", defaultPriceAmount: "4100" }),
      item({ name: "Tiling", unit: "sq m", category: "Finishes", defaultPriceAmount: "9500" }),
      item({ name: "Excavator", defaultPriceAmount: "150000", defaultPriceCurrency: "JPY" }),
    ];
    const base = parseCatalogState(new URLSearchParams(""));
    expect(filterCatalog(all, { ...base, q: "50 KG" }, false).map((i) => i.name)).toEqual(["Cement"]);
    expect(filterCatalog(all, { ...base, q: "2523" }, false).map((i) => i.name)).toEqual(["Cement"]);
    expect(filterCatalog(all, { ...base, q: "sq m" }, false).map((i) => i.name)).toEqual(["Tiling"]);
    expect(filterCatalog(all, { ...base, q: "finish" }, false).map((i) => i.name)).toEqual(["Tiling"]);
    expect(filterCatalog(all, { ...base, min: "50", max: "100" }, false).map((i) => i.name)).toEqual(["Tiling"]);
    expect(filterCatalog(all, { ...base, min: "100000" }, false).map((i) => i.name)).toEqual(["Excavator"]);
  });

  it("names the price filter by what it's set to", () => {
    expect(priceLabel("", "", "USD", formatMoney)).toBe("Price");
    expect(priceLabel("100", "5000", "USD", formatMoney)).toBe("$100.00 – $5,000.00");
    expect(priceLabel("100", "", "USD", formatMoney)).toBe("From $100.00");
    expect(priceLabel("", "50", "USD", formatMoney)).toBe("Up to $50.00");
  });
});
