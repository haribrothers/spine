import { describe, expect, it } from "vitest";
import { HSN_SAC_MESSAGE, isValidHsnSac, missingHsnSacMessage } from "./gst.ts";
import { hsnSacSchema } from "../schemas/common.ts";
import { createCatalogItemSchema } from "../schemas/catalog.ts";
import { invoiceLineInputSchema } from "../schemas/invoices.ts";

describe("US-TAX-14 · add HSN or SAC codes to items and lines", () => {
  it("takes 4, 6 or 8 digits", () => {
    for (const ok of ["9403", "998391", "94031010"]) expect(isValidHsnSac(ok)).toBe(true);
    for (const bad of ["940", "94031", "9403101", "940310100", "94A3", ""]) expect(isValidHsnSac(bad)).toBe(false);
    expect(HSN_SAC_MESSAGE).toBe("Enter 4, 6 or 8 digits.");
  });

  it("refuses anything else on items and lines, and treats a blank as none", () => {
    expect(hsnSacSchema.safeParse("94031").error?.issues[0]?.message).toBe("Enter 4, 6 or 8 digits.");
    expect(hsnSacSchema.parse(" 9403 ")).toBe("9403");
    expect(hsnSacSchema.parse("")).toBeNull();
    expect(createCatalogItemSchema.parse({ name: "Kitchen", unit: "set", defaultPriceAmount: "1", defaultPriceCurrency: "INR", hsnSac: "9403" }).hsnSac).toBe("9403");
    expect(invoiceLineInputSchema.safeParse({ name: "Kitchen", hsnSac: "12345" }).success).toBe(false);
  });

  it("words the warning for lines with no code", () => {
    expect(missingHsnSacMessage(1)).toBe("1 line has no HSN/SAC code. GSTR-1 needs them.");
    expect(missingHsnSacMessage(3)).toBe("3 lines have no HSN/SAC code. GSTR-1 needs them.");
  });
});
