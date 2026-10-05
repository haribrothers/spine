import { describe, expect, it } from "vitest";
import { daysBetween, orgClock } from "./org-clock";

/** US-INV-19 — "Send at" is organisation time: the server's time zone. */
describe("US-INV-19 · organisation clock", () => {
  it("gives the local date and 24-hour time in the organisation's time zone", () => {
    const now = new Date("2026-10-05T23:30:00Z");
    expect(orgClock(now, "UTC")).toEqual({ date: "2026-10-05", time: "23:30" });
    expect(orgClock(now, "Australia/Sydney")).toEqual({ date: "2026-10-06", time: "10:30" });
    expect(orgClock(now, "America/New_York")).toEqual({ date: "2026-10-05", time: "19:30" });
  });

  it("counts whole calendar days, negative before the due date", () => {
    expect(daysBetween("2026-09-28", "2026-10-05")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-05")).toBe(-3);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});
