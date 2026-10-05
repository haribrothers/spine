import { describe, expect, it } from "vitest";
import { progressClaimLabel } from "./job-costing.ts";

/** US-JOB-29 (D-128) — the progress claim label. */
describe("US-JOB-29 · progress claim numbers", () => {
  it("reads 'Progress claim 3 · JOB-002' on the PDF and email", () => {
    expect(progressClaimLabel(3, { jobNumber: "JOB-002" })).toBe("Progress claim 3 · JOB-002");
  });

  it("marks a voided claim, and works without a job number", () => {
    expect(progressClaimLabel(2, { jobNumber: "JOB-002", voided: true })).toBe("Progress claim 2 (void) · JOB-002");
    expect(progressClaimLabel(1)).toBe("Progress claim 1");
  });
});
