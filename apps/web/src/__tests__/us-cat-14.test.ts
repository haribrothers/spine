import { describe, expect, it } from "vitest";
import { lineAmount } from "../app/(app)/catalog/make-bundle-dialog";
import { item } from "./catalog-fixtures";

describe("US-CAT-14 · make a bundle from items", () => {
  it("shows each line at quantity × default price, rounded half-up once", () => {
    expect(lineAmount(item({ defaultPriceAmount: "41000" }), 2)).toBe(82000n);
    expect(lineAmount(item({ defaultPriceAmount: "333" }), 1.5)).toBe(500n);
    expect(lineAmount(item({ defaultPriceAmount: "9500" }), 0)).toBe(0n);
    expect(lineAmount(item({ defaultPriceAmount: "9500" }), Number.NaN)).toBe(0n);
  });
});
