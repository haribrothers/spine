import { describe, expect, it } from "vitest";
import { taxLabel } from "../app/(app)/catalog/catalog-list-state";
import type { TaxGroupOption, TaxRateOption } from "../app/(app)/catalog/types";
import { item } from "./catalog-fixtures";

const rates = new Map<string, TaxRateOption>([["r1", { id: "r1", name: "Sales tax 8%", rate: 8, isCompound: false, archivedAt: null }]]);
const groups = new Map<string, TaxGroupOption>([["g1", { id: "g1", name: "GST 18%", archivedAt: null, taxRates: [] }]]);

describe("US-CAT-11 · read an item's tax in the list", () => {
  it("names the default tax, says so for a deliberately untaxed item, and flags No tax", () => {
    expect(taxLabel(item({ defaultTaxGroupId: "g1", defaultTaxRatePercentage: 18 }), rates, groups, true)).toEqual({ kind: "tax", text: "GST 18%" });
    expect(taxLabel(item({ defaultTaxRateId: "r1", defaultTaxRatePercentage: 8 }), rates, groups, false)).toEqual({ kind: "tax", text: "Sales tax 8%" });
    expect(taxLabel(item({ defaultTaxRateId: "gone", defaultTaxRatePercentage: 5 }), rates, groups, false)).toEqual({ kind: "tax", text: "5%" });
    expect(taxLabel(item({ supplyClass: "exempt" }), rates, groups, true)).toEqual({ kind: "class", text: "Exempt" });
    expect(taxLabel(item({ supplyClass: "non_taxable" }), rates, groups, false)).toEqual({ kind: "class", text: "Non-taxable" });
    expect(taxLabel(item({ supplyClass: "zero_rated" }), rates, groups, true)).toEqual({ kind: "class", text: "Zero-rated" });
    expect(taxLabel(item({ supplyClass: "zero_rated" }), rates, groups, false)).toEqual({ kind: "none", text: "No tax" });
    expect(taxLabel(item({ supplyClass: "taxable" }), rates, groups, true)).toEqual({ kind: "none", text: "No tax" });
  });
});
