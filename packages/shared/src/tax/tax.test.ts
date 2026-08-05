import { describe, expect, it } from "vitest";
import { money } from "../money/money";
import { computeLineTax, type TaxRate } from "./tax";

describe("computeLineTax", () => {
  const gst: TaxRate = { id: "1", name: "GST", rate: 0.1, isCompound: false };

  it("computes exclusive tax", () => {
    const result = computeLineTax(money(10000n, "AUD"), [gst], false);
    expect(result.taxAmount).toEqual(money(1000n, "AUD"));
    expect(result.total).toEqual(money(11000n, "AUD"));
  });

  it("computes inclusive tax", () => {
    const result = computeLineTax(money(11000n, "AUD"), [gst], true);
    expect(result.total).toEqual(money(11000n, "AUD"));
    expect(result.taxAmount.amount).toBeGreaterThan(0n);
  });

  it("compounds a second tax rate on top of the first", () => {
    const pst: TaxRate = { id: "2", name: "PST", rate: 0.07, isCompound: true };
    const result = computeLineTax(money(10000n, "CAD"), [gst, pst], false);
    // GST = 1000, PST = 7% of (10000 + 1000) = 770
    expect(result.taxAmount).toEqual(money(1770n, "CAD"));
  });
});
