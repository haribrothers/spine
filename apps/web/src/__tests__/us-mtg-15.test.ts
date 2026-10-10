import { describe, expect, it } from "vitest";
import { UPCOMING_DAYS, UPCOMING_LIMIT, rangeLabel, upcomingLabel, visibleRange } from "../app/(app)/meetings/meetings-state";

const now = new Date(2026, 9, 10, 10, 20);

describe("US-MTG-15 · sidebar lists", () => {
  it("lists the next 8 meetings in the next 60 days", () => {
    expect(UPCOMING_LIMIT).toBe(8);
    expect(UPCOMING_DAYS).toBe(60);
  });

  it("says when each upcoming meeting is", () => {
    expect(upcomingLabel(new Date(2026, 9, 10, 13, 0), false, now)).toBe("Today · 1:00 PM");
    expect(upcomingLabel(new Date(2026, 9, 11, 9, 0), false, now)).toBe("Tomorrow · 9:00 AM");
    expect(upcomingLabel(new Date(2026, 9, 13, 14, 30), false, now)).toBe("Tue 13 Oct · 2:30 PM");
    expect(upcomingLabel(new Date(2026, 9, 16), true, now)).toBe("Fri 16 Oct · All day");
  });

  it("counts meetings by contact over the range the heading shows, and labels it", () => {
    expect(visibleRange("week", now)).toEqual({ start: new Date(2026, 9, 4), end: new Date(2026, 9, 10) });
    expect(visibleRange("month", now)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 9, 31) });
    expect(visibleRange("day", now)).toEqual({ start: new Date(2026, 9, 10), end: new Date(2026, 9, 10) });
    expect(visibleRange("agenda", now).end).toEqual(new Date(2026, 11, 8));
    expect(rangeLabel("week", now, now)).toBe("This week");
    expect(rangeLabel("week", new Date(2026, 9, 14), now)).toBe("Week of 11 Oct");
    expect(rangeLabel("month", now, now)).toBe("This month");
    expect(rangeLabel("month", new Date(2026, 10, 3), now)).toBe("November 2026");
    expect(rangeLabel("day", now, now)).toBe("Today");
    expect(rangeLabel("agenda", now, now)).toBe("From 10 Oct");
  });
});
