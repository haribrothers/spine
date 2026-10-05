import { describe, expect, it } from "vitest";
import { activityMessage, groupQuoteViews, initialsOf } from "./schemas/activity-feed.ts";

describe("US-DASH-19 · who did what in the activity feed", () => {
  it("writes the sentence with the actor first and a grouped count last", () => {
    expect(activityMessage({ name: "Alex Morgan", kind: "member" }, [{ text: "recorded a payment of " }, { text: "$5,000.00", strong: true }, { text: " from Maple Ridge Developments" }])).toBe(
      "Alex Morgan recorded a payment of $5,000.00 from Maple Ridge Developments",
    );
    expect(activityMessage({ name: "Harborview Construction Co.", kind: "customer" }, [{ text: "viewed QUO-0004" }], 3)).toBe("Harborview Construction Co. viewed QUO-0004 · 3 times");
    expect(activityMessage(null, [{ text: "Hotel lobby renovation was marked completed" }], 1)).toBe("Hotel lobby renovation was marked completed");
  });

  it("folds views of one quote within 24 hours into one row with the latest time", () => {
    const h = (hours: number) => new Date(Date.UTC(2026, 9, 5, 12) - hours * 3_600_000);
    const rows = groupQuoteViews([
      { quoteId: "q4", at: h(0) },
      { quoteId: "q2", at: h(1) },
      { quoteId: "q4", at: h(3) },
      { quoteId: "q4", at: h(23) },
      { quoteId: "q4", at: h(30) },
    ]);
    expect(rows.map((r) => [r.quoteId, r.count, r.at.toISOString()])).toEqual([
      ["q4", 3, h(0).toISOString()],
      ["q2", 1, h(1).toISOString()],
      ["q4", 1, h(30).toISOString()],
    ]);
  });

  it("makes initials for avatars", () => {
    expect(initialsOf("Alex Morgan")).toBe("AM");
    expect(initialsOf("Harborview Construction Co.")).toBe("HC");
    expect(initialsOf("marcus")).toBe("M");
  });
});
