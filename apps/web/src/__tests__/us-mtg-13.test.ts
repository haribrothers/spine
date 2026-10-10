import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@spine/ui";
import { countByDay, monthGrid } from "../app/(app)/meetings/meetings-state";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe("US-MTG-13 · busy days in the mini calendar", () => {
  it("counts each meeting on its day, recurring ones on every day they occur, cancelled ones not at all", () => {
    const events: CalendarEvent[] = [
      { id: "a", title: "Slab pour review", start: at(7, 9), end: at(7, 10), color: "blue" },
      { id: "b", title: "Quote walkthrough", start: at(7, 16), end: at(7, 17), color: "green" },
      {
        id: "c",
        title: "Weekly site planning",
        start: at(5, 9),
        end: at(5, 9, 45),
        color: "blue",
        recurrence: { frequency: "weekly", interval: 1, end: { type: "count", count: 3 } },
        occurrenceExceptions: [{ occurrenceDate: at(12, 9), status: "cancelled" }],
      },
    ];
    const counts = countByDay(events, new Date(2026, 9, 1), new Date(2026, 9, 31));
    expect(counts.get("2026-10-07")).toBe(2);
    expect(counts.get("2026-10-05")).toBe(1);
    expect(counts.get("2026-10-12")).toBeUndefined();
    expect(counts.get("2026-10-19")).toBe(1);
    expect(counts.get("2026-10-08")).toBeUndefined();
  });

  it("counts a meeting that spans days on each of them, inside the range only", () => {
    const events: CalendarEvent[] = [{ id: "d", title: "Site visit", start: new Date(2026, 9, 30), end: new Date(2026, 10, 2), allDay: true, color: "teal" }];
    const counts = countByDay(events, new Date(2026, 9, 1), new Date(2026, 9, 31));
    expect([...counts.keys()]).toEqual(["2026-10-30", "2026-10-31"]);
  });

  it("loads the mini calendar's whole weeks for its month", () => {
    const grid = monthGrid(new Date(2026, 9, 10));
    expect(grid.start).toEqual(new Date(2026, 8, 27));
    expect(grid.end).toEqual(new Date(2026, 9, 31));
  });
});
