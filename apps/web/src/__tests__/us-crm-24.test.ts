import { describe, expect, it } from "vitest";
import { CLOSED_WINDOW_DAYS, WIN_RATE_DAYS, closedWithin, pipelineSummary, totalsByCurrency } from "../app/(app)/leads/pipeline-state";
import { NOW, daysAgo, lead } from "./pipeline-fixtures";

describe("US-CRM-24 · the whole pipeline at a glance", () => {
  it("slim Won and Lost columns look back 30 days; the win rate 90", () => {
    expect(CLOSED_WINDOW_DAYS).toBe(30);
    expect(WIN_RATE_DAYS).toBe(90);
    expect(closedWithin(lead({ stageKind: "won", stageChangedAt: daysAgo(29) }), 30, NOW)).toBe(true);
    expect(closedWithin(lead({ stageKind: "won", stageChangedAt: daysAgo(31) }), 30, NOW)).toBe(false);
    expect(closedWithin(lead({ stageKind: "open", stageChangedAt: daysAgo(1) }), 30, NOW)).toBe(false);
  });

  it("adds up the open pipeline per currency, won this month, the win rate and overdue follow-ups", () => {
    const leads = [
      lead({ valueAmount: "100000", valueCurrency: "INR" }),
      lead({ valueAmount: "50000", valueCurrency: "INR" }),
      lead({ valueAmount: "2000", valueCurrency: "USD", nextFollowUp: { id: "a", type: "call", dueAt: daysAgo(2) } }),
      lead({ stageKind: "won", valueAmount: "300000", stageChangedAt: daysAgo(3) }),
      // Won last month (still in the 90-day win rate) and lost within 90 days.
      lead({ stageKind: "won", valueAmount: "999", stageChangedAt: daysAgo(40) }),
      lead({ stageKind: "lost", stageChangedAt: daysAgo(10) }),
      // Too old for the win rate.
      lead({ stageKind: "lost", stageChangedAt: daysAgo(120) }),
      // A closed lead with an old follow-up isn't an overdue follow-up.
      lead({ stageKind: "lost", stageChangedAt: daysAgo(5), nextFollowUp: { id: "b", type: "call", dueAt: daysAgo(9) } }),
    ];
    const summary = pipelineSummary(leads, NOW);
    expect(summary.open).toEqual({ count: 3, totals: [["INR", 150000n], ["USD", 2000n]] });
    expect(summary.wonThisMonth).toEqual({ count: 1, totals: [["INR", 300000n]] });
    expect(summary.winRate).toEqual({ won: 2, closed: 4, rate: 50 });
    expect(summary.overdue).toBe(1);
  });

  it("has no win rate when nothing closed in 90 days", () => {
    expect(pipelineSummary([lead()], NOW).winRate).toEqual({ won: 0, closed: 0, rate: null });
  });

  it("totals a column per currency, in the order they appear", () => {
    expect(totalsByCurrency([lead({ valueCurrency: "USD", valueAmount: "5" }), lead({ valueCurrency: "INR", valueAmount: "7" }), lead({ valueCurrency: "USD", valueAmount: "1" })])).toEqual([
      ["USD", 6n],
      ["INR", 7n],
    ]);
  });
});
