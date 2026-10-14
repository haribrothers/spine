import { describe, expect, it } from "vitest";
import { nextStep } from "../app/(app)/jobs/job-page-state";
import { job, milestone } from "./job-fixtures";

const can = { invoice: true, complete: () => true, release: true };

describe("US-JOB-34 · see a job at a glance, change its status and take the next step", () => {
  const prep = milestone({ id: "a", name: "Site preparation", sequence: 0, status: "invoiced" });
  const steel = milestone({ id: "b", name: "Steel structure", sequence: 1, status: "completed" });
  const roof = milestone({ id: "c", name: "Roofing & handover", sequence: 2, status: "pending" });

  it("invoices a completed milestone first", () => {
    expect(nextStep(job({}), [roof, steel, prep], can)?.label).toBe("Invoice Steel structure");
  });

  it("else completes the next pending milestone", () => {
    expect(nextStep(job({}), [prep, { ...steel, status: "invoiced" }, roof], can)?.label).toBe("Complete Roofing & handover");
    // Without the right to invoice, completing is next.
    expect(nextStep(job({}), [prep, steel, roof], { ...can, invoice: false })?.label).toBe("Complete Roofing & handover");
  });

  it("else releases retention once the job is completed with retention held", () => {
    const all = [prep, { ...steel, status: "invoiced" as const }, { ...roof, status: "invoiced" as const }];
    expect(nextStep(job({ status: "completed", retentionHeld: "340000" }), all, can)).toEqual({ kind: "release", label: "Release retention" });
    expect(nextStep(job({ status: "completed", retentionHeld: "0" }), all, can)).toBeNull();
    expect(nextStep(job({ status: "active", retentionHeld: "340000" }), all, can)).toBeNull();
    expect(nextStep(job({ status: "completed", retentionHeld: "340000" }), all, { ...can, release: false })).toBeNull();
  });
});
