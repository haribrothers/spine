import { describe, expect, it } from "vitest";
import { billingFigures, billingGapMessage } from "./job-costing.ts";
import { updateJobSchema } from "./schemas/jobs.ts";

/** US-JOB-28 (D-127) — percent complete beside billed %. */
describe("US-JOB-28 · percent complete and billing", () => {
  it("55% complete and 40% billed: 15 points behind", () => {
    const figures = billingFigures(4850000n, 1940000n, 55);
    expect(figures).toMatchObject({ billedPct: 40, percentComplete: 55, gapPts: -15 });
    expect(billingGapMessage(figures.gapPts)).toBe("Billing is 15 points behind the work — check for a milestone to invoice.");
  });

  it("30% complete and 40% billed: 10 points ahead", () => {
    expect(billingGapMessage(billingFigures(4850000n, 1940000n, 30).gapPts)).toBe("Billing is 10 points ahead of the work.");
  });

  it("no line under 10 points or without percent complete", () => {
    expect(billingGapMessage(billingFigures(4850000n, 1940000n, 49).gapPts)).toBeNull();
    expect(billingFigures(4850000n, 1940000n).gapPts).toBeNull();
    expect(billingGapMessage(null)).toBeNull();
  });

  it("percent complete is 0–100 or blank", () => {
    expect(updateJobSchema.parse({ percentComplete: 55 }).percentComplete).toBe(55);
    expect(updateJobSchema.parse({ percentComplete: null }).percentComplete).toBeNull();
    expect(updateJobSchema.safeParse({ percentComplete: 120 }).error?.issues[0]?.message).toBe("Enter a percentage from 0 to 100.");
    expect(updateJobSchema.safeParse({ percentComplete: -1 }).error?.issues[0]?.message).toBe("Enter a percentage from 0 to 100.");
  });
});
