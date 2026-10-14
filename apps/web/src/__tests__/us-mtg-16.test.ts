import { describe, expect, it } from "vitest";
import { calendarQuery, parseCalendarParams, parseDay } from "../app/(app)/meetings/meetings-state";

const today = new Date(2026, 9, 10, 10, 20);

describe("US-MTG-16 · the same view and date on return", () => {
  it("writes the view and date to the address, leaving the defaults out", () => {
    expect(calendarQuery("week", today, today)).toBe("");
    expect(calendarQuery("month", new Date(2026, 9, 12), today)).toBe("view=month&date=2026-10-12");
    expect(calendarQuery("day", today, today)).toBe("view=day");
  });

  it("reads them back, ignoring anything it doesn't understand", () => {
    expect(parseCalendarParams(new URLSearchParams("view=month&date=2026-10-12"))).toEqual({ view: "month", date: new Date(2026, 9, 12) });
    expect(parseCalendarParams(new URLSearchParams("view=year&date=2026-02-30"))).toEqual({ view: null, date: null });
    expect(parseCalendarParams(new URLSearchParams("view=day"))).toEqual({ view: "day", date: null });
    expect(parseDay("12/10/2026")).toBeNull();
  });
});
