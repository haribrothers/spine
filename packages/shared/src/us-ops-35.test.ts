import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";

describe("US-OPS-35", () => {
  it("history reads who removed which file and why", () => {
    const entry = {
      action: "attachment_removed",
      entityType: "vendor_bill",
      actorName: "Alex Morgan",
      changes: [
        { field: "attachment", from: "delivery-docket-site.jpg", to: null },
        { field: "reason", from: null, to: "Wrong docket — belongs to bill 88240" },
      ],
    };
    expect(describeHistoryEntry(entry, "this bill", "vendor_bill")).toBe("Alex Morgan removed attachment delivery-docket-site.jpg — Wrong docket — belongs to bill 88240");
  });
});
