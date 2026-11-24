import { describe, expect, it } from "vitest";
import { SUPPLY_CLASSES, SUPPLY_CLASS_LABELS, lineSupplyClass, supplyClassTaxError } from "./supply-class.ts";
import { createCatalogItemSchema } from "../schemas/catalog.ts";
import { invoiceLineInputSchema } from "../schemas/invoices.ts";

describe("US-TAX-11 · mark supplies as zero-rated, exempt or outside tax", () => {
  it('offers "Taxable", "Zero-rated", "Exempt" and "Non-taxable (outside GST/VAT)"', () => {
    expect(SUPPLY_CLASSES.map((c) => SUPPLY_CLASS_LABELS[c])).toEqual(["Taxable", "Zero-rated", "Exempt", "Non-taxable (outside GST/VAT)"]);
  });

  it("a line with tax is taxable; a line without keeps its item's type, else zero-rated", () => {
    expect(lineSupplyClass(18, undefined)).toBe("taxable");
    expect(lineSupplyClass("5", "zero_rated")).toBe("taxable");
    expect(lineSupplyClass(0, undefined)).toBe("zero_rated");
    expect(lineSupplyClass(0, null)).toBe("zero_rated");
    expect(lineSupplyClass(0, "exempt")).toBe("exempt");
    expect(lineSupplyClass(0, "non_taxable")).toBe("non_taxable");
  });

  it("refuses tax on an exempt or non-taxable line", () => {
    expect(supplyClassTaxError("exempt", 18)).toBe("An exempt line has no tax. Change the supply type to Taxable to add tax.");
    expect(supplyClassTaxError("non_taxable", 5)).toBe("A non-taxable line has no tax. Change the supply type to Taxable to add tax.");
    expect(supplyClassTaxError("exempt", 0)).toBeNull();
    expect(supplyClassTaxError("taxable", 18)).toBeNull();
    expect(supplyClassTaxError("zero_rated", 18)).toBeNull();
    expect(supplyClassTaxError(undefined, 18)).toBeNull();
  });

  it("accepts a supply type on catalogue items and document lines", () => {
    expect(createCatalogItemSchema.parse({ name: "Design", unit: "hour", defaultPriceAmount: "100", defaultPriceCurrency: "INR", supplyClass: "exempt" }).supplyClass).toBe("exempt");
    expect(invoiceLineInputSchema.parse({ name: "Design", supplyClass: "non_taxable" }).supplyClass).toBe("non_taxable");
    expect(invoiceLineInputSchema.safeParse({ name: "Design", supplyClass: "nil" }).success).toBe(false);
  });
});
