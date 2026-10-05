import { describe, expect, it } from "vitest";
import { updateJobSchema } from "./schemas/jobs.ts";

/** US-JOB-24 (D-125) — a job's cost budget: optional, never negative. */
describe("US-JOB-24 · job cost budget", () => {
  it("takes minor units, or null to clear", () => {
    expect(updateJobSchema.parse({ costBudgetAmount: "3200000" }).costBudgetAmount).toBe(3200000n);
    expect(updateJobSchema.parse({ costBudgetAmount: null }).costBudgetAmount).toBeNull();
    expect(updateJobSchema.parse({}).costBudgetAmount).toBeUndefined();
  });

  it("refuses a negative budget", () => {
    expect(updateJobSchema.safeParse({ costBudgetAmount: "-1" }).error?.issues[0]?.message).toBe("Enter a budget of zero or more.");
  });
});
