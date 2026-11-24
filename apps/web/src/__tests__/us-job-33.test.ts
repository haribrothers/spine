import { describe, expect, it } from "vitest";
import { completePct, dueNote, nextMilestoneNote } from "../app/(app)/jobs/jobs-list-state";
import { job } from "./job-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-JOB-33 · read a job's next milestone and progress in the list", () => {
  it("says when the next milestone is due", () => {
    expect(dueNote("2026-10-13", now, "en-GB")).toEqual({ text: "Due in 3 days", tone: "soon" });
    expect(dueNote("2026-10-10", now, "en-GB")).toEqual({ text: "Due today", tone: "soon" });
    expect(dueNote("2026-10-08", now, "en-GB")).toEqual({ text: "Overdue 2 days", tone: "over" });
    expect(dueNote("2026-10-30", now, "en-GB")).toEqual({ text: "Due 30 Oct", tone: "" });
    expect(dueNote(null, now)).toEqual({ text: "No due date", tone: "" });
  });

  it("names the next milestone, or says all billed, ready to bill or no milestones", () => {
    expect(nextMilestoneNote(job({ nextMilestone: { id: "m", name: "Foundations", dueDate: "2026-10-13" }, milestoneCounts: { total: 3, completed: 1 } }), now)).toMatchObject({ name: "Foundations", text: "Due in 3 days" });
    expect(nextMilestoneNote(job({ nextMilestone: null, milestoneCounts: { total: 3, completed: 3 }, readyToBillCount: 0 }), now).name).toBe("All billed");
    expect(nextMilestoneNote(job({ nextMilestone: null, milestoneCounts: { total: 3, completed: 3 }, readyToBillCount: 1 }), now)).toMatchObject({ name: "Ready to bill", text: "1 to invoice" });
    expect(nextMilestoneNote(job({ nextMilestone: null, milestoneCounts: { total: 0, completed: 0 } }), now).name).toBe("No milestones yet");
  });

  it("complete % is the owner's estimate, else the share of milestones done", () => {
    expect(completePct(job({ percentComplete: 35, milestoneCounts: { total: 3, completed: 3 } }))).toBe(35);
    expect(completePct(job({ percentComplete: null, milestoneCounts: { total: 3, completed: 2 } }))).toBe(67);
    expect(completePct(job({ percentComplete: null, milestoneCounts: { total: 0, completed: 0 } }))).toBeNull();
  });
});
