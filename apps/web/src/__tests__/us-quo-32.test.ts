import { describe, expect, it } from "vitest";
import type { QuoteActivityEntry } from "@spine/shared";
import { activityText, groupActivity } from "../app/(app)/quotes/quote-activity";

const entry = (type: QuoteActivityEntry["type"], at: string, over: Partial<QuoteActivityEntry> = {}): QuoteActivityEntry => ({ type, at, actorName: null, detail: null, ...over });

describe("US-QUO-32 · follow what happened to a quote", () => {
  it("groups views in a row into one entry, keeping the latest time", () => {
    const grouped = groupActivity([
      entry("viewed", "2026-10-14T15:20:00Z"),
      entry("viewed", "2026-10-14T10:00:00Z"),
      entry("viewed", "2026-10-13T09:00:00Z"),
      entry("link_copied", "2026-10-13T08:00:00Z", { actorName: "Priya Raman" }),
      entry("viewed", "2026-10-12T09:00:00Z"),
    ]);
    expect(grouped.map((g) => [g.type, g.views ?? null, g.at])).toEqual([
      ["viewed", 3, "2026-10-14T15:20:00Z"],
      ["link_copied", null, "2026-10-13T08:00:00Z"],
      ["viewed", 1, "2026-10-12T09:00:00Z"],
    ]);
    expect(activityText(grouped[0]!)).toBe("Viewed by the customer 3 times");
  });

  it("says what each entry is", () => {
    expect(activityText(entry("emailed", "", { detail: "ananya@example.com" }))).toBe("Emailed to ananya@example.com");
    expect(activityText(entry("email_failed", "", { detail: "Mailbox full" }))).toBe("Email failed: Mailbox full");
    expect(activityText(entry("accepted", "", { actorName: "Ananya Rao", method: "public_link" }))).toBe("Accepted online by Ananya Rao");
    expect(activityText(entry("accepted", "", { actorName: "Ravi", method: "in_person" }))).toBe("Accepted in person, recorded by Ravi");
    expect(activityText(entry("rejected", "", { actorName: "Ananya Rao", method: "public_link" }))).toBe("Declined online by Ananya Rao");
    expect(activityText(entry("revised", "", { detail: "v1" }))).toBe("Revised from v1");
    expect(activityText(entry("converted_to_invoice", "", { detail: "INV-0031" }))).toBe("Converted to an invoice · INV-0031");
    expect(activityText(entry("converted_to_job", "", { detail: "JOB-0012" }))).toBe("Converted to a job · JOB-0012");
  });
});
