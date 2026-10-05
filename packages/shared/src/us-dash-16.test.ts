import { describe, expect, it } from "vitest";
import { buildToday } from "./schemas/today.ts";

/** Local times, so the test reads the same in any time zone. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe("US-DASH-16 · today's schedule", () => {
  // Sunday 4 October 2026, 9:00.
  const now = new Date(2026, 9, 4, 9, 0);

  it("merges meetings today, milestones due within 7 days, follow-ups due today or overdue and the next meeting, in time order", () => {
    const entries = buildToday({
      now,
      meetings: [
        { id: "m2", title: "Monday site stand-up", startAt: at(2026, 10, 5, 8), location: "Marina office fit-out" },
        { id: "m1", title: "Weekly crew scheduling", startAt: at(2026, 10, 4, 14, 30), location: "office" },
        { id: "m3", title: "Later meeting", startAt: at(2026, 10, 7, 10) },
      ],
      milestones: [
        { milestoneId: "ms1", jobId: "j1", jobName: "Marina office fit-out", name: "Mobilisation & site setup", dueDate: "2026-10-03" },
        { milestoneId: "ms2", jobId: "j1", jobName: "Marina office fit-out", name: "Too far out", dueDate: "2026-10-20" },
      ],
      followups: [
        { id: "f1", type: "call", notes: "Call back Priya Nair", dueAt: at(2026, 10, 4, 11), contactId: "c1", contactName: "Harborview Construction Co." },
        { id: "f2", type: "task", notes: null, dueAt: at(2026, 10, 6, 11), contactId: null },
      ],
    });

    expect(entries.map((e) => [e.when, e.title, e.detail])).toEqual([
      ["Due Sat", "Mobilisation & site setup", "Milestone · Marina office fit-out"],
      ["Today", "Call back Priya Nair", "Follow-up · Harborview Construction Co."],
      ["2:30 PM", "Weekly crew scheduling", "Meeting · office"],
      ["Tomorrow 8:00", "Monday site stand-up", "Meeting · Marina office fit-out"],
    ]);
    expect(entries[0]!.href).toBe("/jobs/j1");
    expect(entries[1]!.href).toBe("/contacts/c1");
  });

  it("names the day for a next meeting further out, and an overdue follow-up's day", () => {
    const entries = buildToday({
      now,
      meetings: [{ id: "m3", title: "Site walk", startAt: at(2026, 10, 7, 10) }],
      milestones: [{ milestoneId: "ms", jobId: "j", jobName: "Job", name: "Today's milestone", dueDate: "2026-10-04" }],
      followups: [{ id: "f", type: "call", notes: "  ", dueAt: at(2026, 10, 1, 9), contactId: null }],
    });
    expect(entries.map((e) => [e.when, e.title, e.detail])).toEqual([
      ["Due Thu", "Call", "Follow-up"],
      ["Due today", "Today's milestone", "Milestone · Job"],
      ["Wed 10:00", "Site walk", "Meeting"],
    ]);
  });

  it("is empty with nothing scheduled", () => {
    expect(buildToday({ now, meetings: [], milestones: [], followups: [] })).toEqual([]);
  });
});
