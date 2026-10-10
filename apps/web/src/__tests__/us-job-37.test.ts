import { describe, expect, it } from "vitest";
import type { JobActivityEntry } from "@spine/shared";
import { groupJobActivity } from "../app/(app)/jobs/job-page-state";
import { jobActivityText } from "../app/(app)/jobs/[id]/job-activity";

const entry = (over: Partial<JobActivityEntry>): JobActivityEntry => ({ at: "2026-10-02T11:00:00Z", type: "created", actorName: "Priya Raman", detail: null, ...over });

describe("US-JOB-37 · follow what happened on a job", () => {
  it("photos added together become one entry", () => {
    const items = groupJobActivity([
      entry({ type: "milestone_completed", detail: "Steel structure", at: "2026-10-02T11:10:00Z" }),
      entry({ type: "photo_added", detail: "Steel structure", actorName: "Ravi Kumar", at: "2026-10-02T11:08:00Z" }),
      entry({ type: "photo_added", detail: "Steel structure", actorName: "Ravi Kumar", at: "2026-10-02T11:07:00Z" }),
      entry({ type: "photo_added", detail: "Steel structure", actorName: "Ravi Kumar", at: "2026-10-02T11:06:00Z" }),
      entry({ type: "photo_added", detail: null, actorName: "Ravi Kumar", at: "2026-10-02T11:05:00Z" }),
      entry({ type: "photo_added", detail: null, actorName: "Ravi Kumar", at: "2026-09-02T11:05:00Z" }),
    ]);
    expect(items.map((i) => [i.type, i.photos])).toEqual([
      ["milestone_completed", undefined],
      ["photo_added", 3],
      ["photo_added", 1],
      ["photo_added", 1],
    ]);
    expect(jobActivityText(items[1]!, "INR")).toEqual({ title: "3 photos added", rest: "with Steel structure" });
  });

  it("says what each entry was about", () => {
    const say = (e: Partial<JobActivityEntry>) => jobActivityText(entry(e), "USD");
    expect(say({ type: "created_from_quote", detail: "QUO-0031" })).toEqual({ title: "Created", rest: "from QUO-0031" });
    expect(say({ type: "status_changed", detail: "on_hold" })).toEqual({ title: "Status changed", rest: "to On hold" });
    expect(say({ type: "milestone_invoiced", detail: "Site preparation · INV-0021" })).toEqual({ title: "Milestone invoiced", rest: "· Site preparation · INV-0021" });
    expect(say({ type: "variation_order_applied", detail: "400000" })).toEqual({ title: "Variation applied", rest: "· +$4,000.00" });
    expect(say({ type: "crew_assigned", detail: "Ravi Kumar" })).toEqual({ title: "Crew assigned", rest: "· Ravi Kumar" });
    expect(say({ type: "milestones_set", detail: "3" })).toEqual({ title: "Milestones set", rest: "· 3 milestones" });
    expect(say({ type: "retention_released", detail: "INV-0031" })).toEqual({ title: "Retention released", rest: "· INV-0031" });
  });
});
