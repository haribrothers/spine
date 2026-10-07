import { describe, expect, it } from "vitest";
import { changePercent, comparePeriods, periodLabel, previousYearEnd, TOO_MANY_MONTHS } from "./schemas/report-compare.ts";

describe("US-RPT-27 · comparison periods", () => {
  it("previous period: whole months move by months, other ranges by days", () => {
    expect(comparePeriods("2026-07-01", "2026-09-30", "previous")).toEqual([
      { label: "Jul – Sep 2026", from: "2026-07-01", to: "2026-09-30" },
      { label: "Apr – Jun 2026", from: "2026-04-01", to: "2026-06-30" },
    ]);
    expect(comparePeriods("2026-03-01", "2026-03-31", "previous")[1]).toEqual({ label: "Feb 2026", from: "2026-02-01", to: "2026-02-28" });
    expect(comparePeriods("2026-01-01", "2026-03-31", "previous")[1]).toEqual({ label: "Oct – Dec 2025", from: "2025-10-01", to: "2025-12-31" });
    expect(comparePeriods("2026-09-11", "2026-09-20", "previous")[1]).toEqual({ label: "Sep 1 – Sep 10, 2026", from: "2026-09-01", to: "2026-09-10" });
  });

  it("same period last year, keeping month ends", () => {
    expect(comparePeriods("2026-07-01", "2026-09-30", "last_year")[1]).toEqual({ label: "Jul – Sep 2025", from: "2025-07-01", to: "2025-09-30" });
    expect(comparePeriods("2028-02-01", "2028-02-29", "last_year")[1]).toEqual({ label: "Feb 2027", from: "2027-02-01", to: "2027-02-28" });
    expect(comparePeriods("2026-01-01", "2026-10-06", "last_year")[1]).toEqual({ label: "Jan 1 – Oct 6, 2025", from: "2025-01-01", to: "2025-10-06" });
  });

  it("each month: one column per month, clipped to the range; at most 24", () => {
    const year = comparePeriods("2026-01-01", "2026-12-31", "monthly");
    expect(year).toHaveLength(12);
    expect(year[0]).toEqual({ label: "Jan 2026", from: "2026-01-01", to: "2026-01-31" });
    expect(year[11]).toEqual({ label: "Dec 2026", from: "2026-12-01", to: "2026-12-31" });
    expect(comparePeriods("2026-08-15", "2026-10-06", "monthly").map((c) => [c.from, c.to])).toEqual([
      ["2026-08-15", "2026-08-31"],
      ["2026-09-01", "2026-09-30"],
      ["2026-10-01", "2026-10-06"],
    ]);
    expect(() => comparePeriods("2024-01-01", "2026-01-31", "monthly")).toThrow(TOO_MANY_MONTHS);
  });

  it("labels", () => {
    expect(periodLabel("2025-11-01", "2026-01-31")).toBe("Nov 2025 – Jan 2026");
    expect(periodLabel("2026-09-30", "2026-09-30")).toBe("Sep 30, 2026");
  });

  it("change % against the earlier figure, one decimal, half away from zero; none against zero", () => {
    expect(changePercent(4217953n, 3612000n)).toBe("16.8");
    expect(changePercent(308547n, 441000n)).toBe("-30.0");
    expect(changePercent(720000n, 720000n)).toBe("0.0");
    expect(changePercent(-50000n, -100000n)).toBe("50.0");
    expect(changePercent(100000n, 0n)).toBeNull();
    expect(changePercent(10005n, 10000n)).toBe("0.1");
  });

  it("previous year end from the financial year start", () => {
    expect(previousYearEnd("2026-09-30", { month: 1, day: 1 })).toBe("2025-12-31");
    expect(previousYearEnd("2026-09-30", { month: 4, day: 1 })).toBe("2026-03-31");
    expect(previousYearEnd("2026-02-15", { month: 4, day: 1 })).toBe("2025-03-31");
  });
});
