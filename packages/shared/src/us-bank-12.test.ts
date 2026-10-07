import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_LABELS, DEFAULT_TEAM_GRANTS, withImpliedPrivileges } from "./schemas/permissions.ts";

describe("US-BANK-12", () => {
  it("lists the three banking rights under Banking, off for General Staff", () => {
    const banking = CAPABILITIES.filter((c) => CAPABILITY_LABELS[c].group === "Banking");
    expect(banking.map((c) => [c, CAPABILITY_LABELS[c].label])).toEqual([
      ["banking.view", "View bank balances and registers"],
      ["banking.record", "Record transfers and other money in or out"],
      ["banking.reconcile", "Reconcile accounts"],
    ]);
    for (const c of banking) expect(DEFAULT_TEAM_GRANTS[c]).toBe(false);
  });

  it("reconciling turns on viewing; turning viewing off turns reconciling off", () => {
    expect(withImpliedPrivileges([{ capability: "banking.reconcile", granted: true }])).toEqual([
      { capability: "banking.reconcile", granted: true },
      { capability: "banking.view", granted: true },
    ]);
    expect(withImpliedPrivileges([{ capability: "banking.view", granted: false }])).toEqual([
      { capability: "banking.view", granted: false },
      { capability: "banking.reconcile", granted: false },
    ]);
    // Unrelated capabilities pass through; an explicit change in the same request wins.
    expect(withImpliedPrivileges([{ capability: "banking.record", granted: true }])).toEqual([{ capability: "banking.record", granted: true }]);
    expect(withImpliedPrivileges([
      { capability: "banking.view", granted: false },
      { capability: "banking.reconcile", granted: false },
    ])).toHaveLength(2);
  });
});
