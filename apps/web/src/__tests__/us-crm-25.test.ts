import { describe, expect, it } from "vitest";
import { COLD_AFTER_DAYS, coldDays, daysInStage, daysLabel, initials, isOverdue } from "../app/(app)/leads/pipeline-state";
import { followUpWhen } from "../app/(app)/leads/lead-card";
import { DAY, NOW, daysAgo, lead } from "./pipeline-fixtures";

describe("US-CRM-25 · cards that show what needs doing", () => {
  it("counts whole days in the stage", () => {
    expect(daysInStage(lead({ stageChangedAt: daysAgo(12) }), NOW)).toBe(12);
    expect(daysLabel(12)).toBe("12 days in stage");
    expect(daysLabel(1)).toBe("1 day in stage");
  });

  it("a follow-up past its due time is overdue", () => {
    expect(isOverdue(lead({ nextFollowUp: { id: "a", type: "call", dueAt: new Date(NOW - 60_000).toISOString() } }), NOW)).toBe(true);
    expect(isOverdue(lead({ nextFollowUp: { id: "a", type: "call", dueAt: new Date(NOW + DAY).toISOString() } }), NOW)).toBe(false);
    expect(isOverdue(lead(), NOW)).toBe(false);
  });

  it("says a follow-up's day, with its time when it has one", () => {
    const at = (days: number, h: number, m = 0) => {
      const d = new Date(NOW + days * DAY);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    expect(followUpWhen(at(1, 10), NOW)).toMatch(/^Tomorrow 10:00$/);
    expect(followUpWhen(at(0, 0), NOW)).toBe("Today");
    expect(followUpWhen(at(6, 0), NOW)).not.toMatch(/Today|Tomorrow/);
  });

  it("nudges an open lead after 14 days with no activity and no change", () => {
    expect(COLD_AFTER_DAYS).toBe(14);
    expect(coldDays(lead({ updatedAt: daysAgo(16) }), NOW)).toBe(16);
    expect(coldDays(lead({ updatedAt: daysAgo(13) }), NOW)).toBeNull();
    // Recent activity or a recent change keeps it warm.
    expect(coldDays(lead({ updatedAt: daysAgo(20), lastActivityAt: daysAgo(2) }), NOW)).toBeNull();
    // Won and lost leads are never "cold".
    expect(coldDays(lead({ stageKind: "won", updatedAt: daysAgo(40) }), NOW)).toBeNull();
  });

  it("shows the owner's initials", () => {
    expect(initials("Priya Raman")).toBe("PR");
    expect(initials("Arjun")).toBe("A");
    expect(initials("Anne Marie de Souza")).toBe("AS");
  });
});
