import { describe, expect, it } from "vitest";
import { billedByMilestones, inOrder, milestoneDueText } from "../app/(app)/jobs/job-page-state";
import { milestone } from "./job-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-JOB-35 · follow a job's milestones and billing at a glance", () => {
  it("bills what's invoiced, in billing order", () => {
    const ms = [milestone({ id: "b", sequence: 1, status: "completed", resolvedAmount: "2720000" }), milestone({ id: "a", sequence: 0, status: "invoiced", resolvedAmount: "2040000" })];
    expect(inOrder(ms).map((m) => m.id)).toEqual(["a", "b"]);
    expect(billedByMilestones(ms)).toBe(2040000n);
  });

  it("says when each is due, overdue in the overdue tone", () => {
    expect(milestoneDueText("2026-10-30", now, "en-GB")).toEqual({ text: "Due 30 Oct · in 20 days", tone: "" });
    expect(milestoneDueText("2026-10-13", now, "en-GB")).toEqual({ text: "Due 13 Oct · in 3 days", tone: "soon" });
    expect(milestoneDueText("2026-10-07", now, "en-GB")).toEqual({ text: "Overdue 3 days", tone: "over" });
    expect(milestoneDueText("2026-10-09", now, "en-GB")).toEqual({ text: "Overdue 1 day", tone: "over" });
  });
});
