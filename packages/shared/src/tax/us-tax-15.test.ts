import { describe, expect, it } from "vitest";
import { legacyGstRates, splitLineTax } from "./gst-split.ts";

describe("US-TAX-15 · splitting a line's GST for the invoice", () => {
  it("halves CGST + SGST, and the parts always add up to the line's tax", () => {
    expect(splitLineTax(3240000n, [{ taxType: "cgst", rate: 9 }, { taxType: "sgst", rate: 9 }]).map((c) => c.amount)).toEqual([1620000n, 1620000n]);
    const odd = splitLineTax(101n, [{ taxType: "cgst", rate: 2.5 }, { taxType: "sgst", rate: 2.5 }]);
    expect(odd.map((c) => c.amount)).toEqual([51n, 50n]);
    expect(odd.reduce((a, c) => a + c.amount, 0n)).toBe(101n);
  });

  it("gives a cess its share", () => {
    const parts = splitLineTax(4000n, [{ taxType: "cgst", rate: 14 }, { taxType: "sgst", rate: 14 }, { taxType: "cess", rate: 12 }]);
    expect(parts.map((c) => [c.taxType, c.amount])).toEqual([["cgst", 1400n], ["sgst", 1400n], ["cess", 1200n]]);
  });

  it("IGST takes it all; nothing to split without tax; credit amounts stay negative", () => {
    expect(splitLineTax(4500n, [{ taxType: "igst", rate: 18 }])).toEqual([{ taxType: "igst", rate: 18, amount: 4500n }]);
    expect(splitLineTax(0n, [{ taxType: "igst", rate: 18 }])).toEqual([]);
    expect(splitLineTax(-101n, [{ taxType: "cgst", rate: 9 }, { taxType: "sgst", rate: 9 }]).map((c) => c.amount)).toEqual([-51n, -50n]);
  });

  it("reads an unnamed rate as CGST + SGST within the state, else IGST", () => {
    expect(legacyGstRates(18, "intra")).toEqual([{ taxType: "cgst", rate: 9 }, { taxType: "sgst", rate: 9 }]);
    expect(legacyGstRates(18, "inter")).toEqual([{ taxType: "igst", rate: 18 }]);
    expect(legacyGstRates(0, "intra")).toEqual([]);
  });
});
