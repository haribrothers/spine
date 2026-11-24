import { describe, expect, it } from "vitest";
import { labourLineAmount, labourLineSchema, labourTotal } from "./schemas/purchases.ts";

/** US-PUR-23 (D-126) — labour as headcount × day rate. */
describe("US-PUR-23 · site labour", () => {
  it("4 masons at 950.00, 3 carpenters at 900.00 and 8 helpers at 650.00 come to 11,700.00", () => {
    const lines = [
      { headcount: 4, dayRateAmount: 95000n },
      { headcount: 3, dayRateAmount: 90000n },
      { headcount: 8, dayRateAmount: 65000n },
    ];
    expect(lines.map(labourLineAmount)).toEqual([380000n, 270000n, 520000n]);
    expect(labourTotal(lines)).toBe(1170000n);
  });

  it("every row needs a trade, at least one worker and a day rate", () => {
    const message = "Every row needs a trade, at least one worker and a day rate.";
    expect(labourLineSchema.safeParse({ trade: " ", headcount: 4, dayRateAmount: "95000" }).error?.issues[0]?.message).toBe(message);
    expect(labourLineSchema.safeParse({ trade: "Mason", headcount: 0, dayRateAmount: "95000" }).error?.issues[0]?.message).toBe(message);
    expect(labourLineSchema.safeParse({ trade: "Mason", headcount: 4, dayRateAmount: "0" }).error?.issues[0]?.message).toBe(message);
    expect(labourLineSchema.parse({ trade: " Mason ", headcount: "4", dayRateAmount: "95000" })).toEqual({ trade: "Mason", headcount: 4, dayRateAmount: 95000n });
  });
});
