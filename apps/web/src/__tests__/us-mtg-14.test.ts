import { describe, expect, it } from "vitest";
import { newMeetingRange } from "../app/(app)/meetings/meetings-state";

describe("US-MTG-14 · New meeting", () => {
  it("starts at the next half hour today, for 30 minutes", () => {
    const now = new Date(2026, 9, 10, 10, 20, 15);
    expect(newMeetingRange(now, now)).toEqual({ start: new Date(2026, 9, 10, 10, 30), end: new Date(2026, 9, 10, 11, 0) });
    const onTheHalf = new Date(2026, 9, 10, 10, 30);
    expect(newMeetingRange(onTheHalf, onTheHalf).start).toEqual(new Date(2026, 9, 10, 11, 0));
  });

  it("starts at 9:00 AM on a shown day that isn't today", () => {
    const now = new Date(2026, 9, 10, 10, 20);
    expect(newMeetingRange(new Date(2026, 9, 14, 17, 0), now)).toEqual({ start: new Date(2026, 9, 14, 9, 0), end: new Date(2026, 9, 14, 9, 30) });
  });
});
