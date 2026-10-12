import { describe, expect, it } from "vitest";
import { CAPABILITIES, DEFAULT_MODULES } from "@spine/shared";
import type { MemberRow } from "../lib/members";
import type { TeamSummary } from "../lib/teams";
import { applyToDraft, changeReason, draftChanges, filterTeams, leftWithoutTeam, matchesSearch, peopleLabel, permissionCount, permissionGroups, sectionsOpened, teamsTotals } from "../app/(app)/team/teams/teams-state";
import { describe as describeEntry } from "../app/(app)/team/teams/[id]/team-page";

const team = (over: Partial<TeamSummary>): TeamSummary => ({ id: "t", name: "Team", description: null, isDefault: false, isDemo: false, memberCount: 0, createdAt: "2026-01-01", members: [], granted: [], ...over });
const member = (id: string, role = "staff", isActive = true): MemberRow => ({ id, userId: id, name: id, email: `${id}@x`, role, isActive, isPrimaryOwner: false, deactivatedAt: null, createdAt: "2026-01-01" });
const TEAMS = [
  team({ id: "gs", name: "General Staff", isDefault: true, description: "Everyday office work", members: [{ memberId: "sarah", name: "Sarah" }, { memberId: "neha", name: "Neha" }], granted: ["contacts.view_all", "banking.view"] }),
  team({ id: "acc", name: "Accounts", description: "Billing and the books", members: [{ memberId: "neha", name: "Neha" }, { memberId: "arun", name: "Arun" }] }),
  team({ id: "est", name: "Estimating" }),
];

describe("US-TEAM-25", () => {
  it("searches name and description", () => {
    expect(filterTeams(TEAMS, "books").map((t) => t.id)).toEqual(["acc"]);
    expect(filterTeams(TEAMS, "GENERAL").map((t) => t.id)).toEqual(["gs"]);
    expect(filterTeams(TEAMS, " ")).toHaveLength(3);
  });

  it("counts the cards: Teams, Staff on no Team, Staff on several", () => {
    const totals = teamsTotals(TEAMS, [member("sarah"), member("neha"), member("arun"), member("kavya"), member("marcus", "field"), member("tom", "staff", false)]);
    expect(totals).toMatchObject({ teams: 3, teamsLabel: "1 default · 1 with no one yet", noTeam: 1, noTeamLabel: "kavya · open in Users", several: 1 });
  });

  it("says what a Team adds up to: sections opened and permissions granted", () => {
    const s = sectionsOpened(["banking.view"], DEFAULT_MODULES);
    expect(s.all.find((x) => x.href === "/banking")?.open).toBe(true);
    expect(s.all.find((x) => x.href === "/receivables")?.open).toBe(false);
    expect(s.total).toBeGreaterThan(10);
    expect(permissionCount(["banking.view", "not.a.capability"], DEFAULT_MODULES).granted).toBe(1);
    expect(permissionCount([], DEFAULT_MODULES).total).toBeLessThanOrEqual(CAPABILITIES.length);
  });

  it("names who'd be left on no Team", () => {
    expect(leftWithoutTeam("acc", ["neha", "arun"], TEAMS)).toEqual(["arun"]);
    expect(peopleLabel(0)).toBe("No one yet");
    expect(peopleLabel(1)).toBe("1 person");
  });
});

describe("US-TEAM-28", () => {
  it("keeps changes as a draft, with the ones that come with them", () => {
    const saved = Object.fromEntries(CAPABILITIES.map((c) => [c, false]));
    const draft = applyToDraft(saved, [{ capability: "banking.reconcile", granted: true }]);
    expect(draftChanges(saved, draft)).toEqual([
      { capability: "banking.view", granted: true },
      { capability: "banking.reconcile", granted: true },
    ]);
    expect(changeReason("banking.view", true, [{ capability: "banking.reconcile", granted: true }])).toBe("Reconciling needs to see the account.");
    const off = applyToDraft(draft, [{ capability: "banking.view", granted: false }]);
    expect(draftChanges(saved, off)).toEqual([]);
  });

  it("groups permissions in the matrix's order and searches labels and descriptions", () => {
    const groups = permissionGroups(DEFAULT_MODULES);
    expect(groups.find((g) => g.label === "Banking")?.capabilities).toEqual(["banking.view", "banking.record", "banking.reconcile"]);
    expect(matchesSearch("banking.reconcile", "statement")).toBe(true);
    expect(matchesSearch("banking.reconcile", "invoice")).toBe(false);
  });
});

describe("US-TEAM-29", () => {
  it("reads each history entry as a sentence", () => {
    expect(describeEntry({ at: "2026-10-12T10:42:00Z", actorName: "Priya", action: "created", changes: [{ field: "name", from: null, to: "Accounts" }, { field: "copiedFrom", from: null, to: "General Staff" }] }).text).toBe("created Accounts from General Staff");
    expect(describeEntry({ at: "", actorName: "Priya", action: "members_changed", changes: [{ field: "added", from: null, to: "Arun Shah" }] }).text).toBe("added Arun Shah");
    const perms = describeEntry({ at: "", actorName: "Priya", action: "privileges_changed", changes: [{ field: "Reconcile accounts", from: "Off", to: "On" }, { field: "View bank balances and registers", from: "Off", to: "On" }] });
    expect(perms.text).toBe("turned on Reconcile accounts and View bank balances and registers");
    expect(perms.chips).toEqual(["+ Reconcile accounts", "+ View bank balances and registers"]);
    expect(describeEntry({ at: "", actorName: "Arjun", action: "updated", changes: [{ field: "description", from: "Billing", to: "Billing and banking" }] })).toMatchObject({ text: "changed the description", chips: ["Billing → Billing and banking"] });
  });
});
