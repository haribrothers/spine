import { describe, expect, it } from "vitest";
import { decimal, multiplyMinor, percentOfMinor, roundFraction } from "../money/decimal.ts";
import { computeDocumentLine, computeLineTax } from "./tax.ts";
import { money } from "../money/money.ts";

describe("US-TAX-07", () => {
  it("keeps a rate of 8.875% exact", () => {
    expect(decimal(8.875)).toEqual({ n: 71n, d: 8n });
    expect(decimal("8.8750")).toEqual({ n: 71n, d: 8n });
    // 8.875% of 1000.00 is exactly 88.75.
    const result = computeLineTax(money(100000n, "USD"), [{ id: "r", name: "NY", percent: 8.875, isCompound: false }], false);
    expect(result.taxAmount.amount).toBe(8875n);
  });

  it("computes quantity 0.1 × 3 (0.3) at 33.33 with decimal maths, rounded half-up once", () => {
    // 0.3 × 33.33 = 9.999 → 10.00. (In floats 0.1 * 3 is 0.30000000000000004.)
    const line = computeDocumentLine({ quantity: "0.3", unitPriceAmount: 3333n, currency: "USD", rates: [], inclusive: false });
    expect(line.grossAmount).toBe(1000n);
  });

  it("rounds a true half up where floating point would round down", () => {
    // 1.005 × 1.00: exactly 100.5 cents → 101. In floats 1.005 * 100 is 100.49999999999999.
    expect(multiplyMinor(100n, 1.005)).toBe(101n);
    expect(1.005 * 100).toBeLessThan(100.5);
    // 1.1% of 1000.00 = 11.00; in floats 1.1 / 100 is 0.011000000000000001.
    expect(percentOfMinor(100000n, 1.1)).toBe(1100n);
  });

  it("applies a discount and then tax on the discounted amount, each rounded once", () => {
    const line = computeDocumentLine({
      quantity: 3,
      unitPriceAmount: 3333n,
      discountPercentage: 12.5,
      currency: "USD",
      rates: [{ id: "r", name: "VAT", percent: 20, isCompound: false }],
      inclusive: false,
    });
    expect(line.grossAmount).toBe(9999n);
    expect(line.discountAmount).toBe(1250n); // 1249.875 → 1250
    expect(line.netAmount).toBe(8749n);
    expect(line.tax.taxAmount.amount).toBe(1750n); // 1749.8 → 1750
  });

  it("backs tax out of a tax-inclusive price exactly", () => {
    const result = computeLineTax(money(11500n, "NZD"), [{ id: "g", name: "GST", percent: 15, isCompound: false }], true);
    expect(result.taxableAmount.amount).toBe(10000n);
    expect(result.taxAmount.amount).toBe(1500n);
  });

  it("rounds negative halves towards +∞, the same direction as positive ones", () => {
    expect(roundFraction({ n: -5n, d: 2n })).toBe(-2n);
    expect(roundFraction({ n: 5n, d: 2n })).toBe(3n);
  });
});
