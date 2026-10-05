import { describe, expect, it } from "vitest";
import { budgetFigures, budgetUsedLabel, wholePercent } from "./job-costing.ts";

/** US-JOB-25 (D-125) — budget used, near at 80%, over above 100%. */
describe("US-JOB-25 · budget spent and warnings", () => {
  it("32,000.00 budget, 24,800.00 spent: 7,200.00 remaining, 78% used", () => {
    expect(budgetFigures(3200000n, 2480000n)).toEqual({ amount: "3200000", spent: "2480000", remaining: "720000", usedPct: 78, state: "ok" });
  });

  it("is 'near' from 80% and 'over' once cost passes the budget", () => {
    expect(budgetFigures(3200000n, 2560000n).state).toBe("near");
    expect(budgetFigures(3200000n, 2720000n)).toMatchObject({ usedPct: 85, state: "near" });
    expect(budgetFigures(3200000n, 3200000n).state).toBe("near");
    expect(budgetFigures(3200000n, 3345000n)).toMatchObject({ remaining: "-145000", usedPct: 105, state: "over" });
  });

  it("no budget is 'none'; a zero budget with cost is over", () => {
    expect(budgetFigures(null, 500n)).toEqual({ amount: null, spent: "500", remaining: null, usedPct: null, state: "none" });
    expect(budgetFigures(0n, 500n).state).toBe("over");
  });

  it("writes the Jobs list text", () => {
    expect(budgetUsedLabel("ok", 78)).toBe("78%");
    expect(budgetUsedLabel("near", 85)).toBe("Nearing · 85%");
    expect(budgetUsedLabel("over", 104)).toBe("Over · 104%");
    expect(budgetUsedLabel("none", null)).toBe("—");
  });

  it("rounds percentages half up", () => {
    expect(wholePercent(775n, 1000n)).toBe(78);
    expect(wholePercent(774n, 1000n)).toBe(77);
    expect(wholePercent(1n, 0n)).toBeNull();
  });
});
