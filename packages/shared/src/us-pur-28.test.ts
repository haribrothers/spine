import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_LABELS, DEFAULT_TEAM_GRANTS } from "./schemas/permissions.ts";

describe("US-PUR-28", () => {
  it("lists the vendor credit rights under 'Vendor credits', granted to General Staff", () => {
    const rights = CAPABILITIES.filter((c) => CAPABILITY_LABELS[c].group === "Vendor credits");
    expect(rights).toEqual([
      // US-TEAM-30: the section's Open permission comes first.
      "vendor_credits.open",
      "vendor_credits.edit_own",
      "vendor_credits.edit_others",
      "vendor_credits.delete_own",
      "vendor_credits.delete_others",
      "vendor_credits.record",
      "vendor_credits.apply",
      "vendor_credits.void",
    ]);
    expect(CAPABILITY_LABELS["vendor_credits.apply"].label).toBe("Apply and refund vendor credits");
    for (const c of rights) expect(DEFAULT_TEAM_GRANTS[c]).toBe(true);
  });
});
