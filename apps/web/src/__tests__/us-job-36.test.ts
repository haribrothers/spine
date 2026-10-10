import { describe, expect, it } from "vitest";
import { groupPhotos } from "../app/(app)/jobs/job-page-state";
import { photoUrl } from "../app/(app)/jobs/[id]/photo-viewer";
import { milestone, photo } from "./job-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-JOB-36 · browse, upload and group site photos", () => {
  it("groups photos under Site photos, then each milestone in order, oldest first, leaving empty groups out", () => {
    const ms = [
      milestone({ id: "steel", name: "Steel structure", sequence: 1, completedAt: "2026-10-02T11:00:00Z" }),
      milestone({ id: "prep", name: "Site preparation", sequence: 0, completedAt: "2026-08-07T10:00:00Z" }),
      milestone({ id: "roof", name: "Roofing & handover", sequence: 2 }),
    ];
    const groups = groupPhotos(
      [
        photo({ id: "2", milestoneId: "steel", createdAt: "2026-10-02T11:05:00Z" }),
        photo({ id: "1", milestoneId: "steel", createdAt: "2026-10-02T11:00:00Z" }),
        photo({ id: "s", milestoneId: null }),
        photo({ id: "p", milestoneId: "prep" }),
        photo({ id: "x", milestoneId: "deleted-milestone" }),
      ],
      ms,
      now,
      "en-GB",
    );
    expect(groups.map((g) => [g.label, g.note, g.photos.map((p) => p.id)])).toEqual([
      ["Site photos", null, ["s", "x"]],
      ["Site preparation", "completed 7 Aug", ["p"]],
      ["Steel structure", "completed 2 Oct", ["1", "2"]],
    ]);
  });

  it("serves photos and downloads through the files API", () => {
    expect(photoUrl("f1")).toMatch(/\/files\/f1$/);
    expect(photoUrl("f1", true)).toMatch(/\/files\/f1\?download=1$/);
  });
});
