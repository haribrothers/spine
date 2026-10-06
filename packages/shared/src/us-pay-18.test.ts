import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_LABELS, DEFAULT_TEAM_GRANTS } from "./schemas/permissions.ts";

describe("US-PAY-18", () => {
  it("'Refund customers' sits in the Payments group, off for General Staff", () => {
    expect(CAPABILITIES).toContain("payments.refund");
    expect(CAPABILITY_LABELS["payments.refund"]).toMatchObject({ label: "Refund customers", group: "Manage Payments" });
    expect(DEFAULT_TEAM_GRANTS["payments.refund"]).toBe(false);
  });
});
