import { describe, expect, it } from "vitest";
import { billingFigures } from "./job-costing.ts";

/** US-JOB-27 (D-127) — billed to date against the contract value. */
describe("US-JOB-27 · billed to date", () => {
  it("48,500.00 contract, 19,400.00 billed: 40%, 29,100.00 left", () => {
    expect(billingFigures(4850000n, 1940000n)).toEqual({ contractValue: "4850000", billedToDate: "1940000", billedPct: 40, leftToBill: "2910000", percentComplete: null, gapPts: null });
  });

  it("billed over the contract leaves a negative amount", () => {
    expect(billingFigures(4850000n, 4900000n)).toMatchObject({ billedPct: 101, leftToBill: "-50000" });
  });

  it("a zero contract has no percentage", () => {
    expect(billingFigures(0n, 100n).billedPct).toBeNull();
  });
});
