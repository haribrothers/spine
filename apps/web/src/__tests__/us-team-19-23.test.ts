import { describe, expect, it } from "vitest";
import { CAPABILITIES, capabilityGroupCounts, isEmailAddress, parseEmailList } from "@spine/shared";
import type { InvitationRow } from "../lib/invitations";
import type { MemberRow } from "../lib/members";
import { navSectionsFor } from "../lib/nav-sections";
import {
  expiresLabel,
  filterInvites,
  filterMembers,
  lastActiveLabel,
  parseUsersState,
  shortDate,
  teamsSentence,
  usersQuery,
  usersTotals,
} from "../app/(app)/team/users/users-list-state";

const NOW = new Date("2026-10-12T12:00:00").getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const member = (over: Partial<MemberRow>): MemberRow => ({
  id: "m",
  userId: "u",
  name: "Someone",
  email: "someone@example.com",
  role: "staff",
  isActive: true,
  isPrimaryOwner: false,
  deactivatedAt: null,
  createdAt: "2026-03-02T00:00:00Z",
  teams: [],
  lastActiveAt: null,
  isDemo: false,
  ...over,
});
const members = [
  member({ id: "priya", name: "Priya Raman", role: "owner", isPrimaryOwner: true, email: "priya@meridian.example" }),
  member({ id: "arjun", name: "Arjun Mehta", role: "owner" }),
  member({ id: "sarah", name: "Sarah Mendes", isDemo: true, teams: [{ id: "g", name: "General Staff" }, { id: "a", name: "Accounts" }] }),
  member({ id: "kavya", name: "Kavya Iyer", email: "kavya@meridian.example" }),
  member({ id: "marcus", name: "Marcus Webb", role: "field" }),
  member({ id: "old", name: "Old Hand", isActive: false }),
];
const invite = (over: Partial<InvitationRow>): InvitationRow => ({ id: "i", email: "sam@example.com", role: "staff", status: "pending", expiresAt: new Date(NOW + 5 * DAY).toISOString(), inviterId: "u", organizationId: "o", ...over });
const invites = [invite({}), invite({ id: "tom", email: "tom.site@example.com", role: "field", expiresAt: new Date(NOW - DAY).toISOString() })];

describe("US-TEAM-19", () => {
  it("keeps tab, role, the no-Team card and search in the address; defaults are left out", () => {
    const state = parseUsersState(new URLSearchParams("tab=invites&role=field&card=no-team&q=tom"));
    expect(state).toEqual({ tab: "invites", role: "field", noTeam: true, q: "tom" });
    expect(usersQuery(state)).toBe("tab=invites&role=field&card=no-team&q=tom");
    expect(usersQuery(parseUsersState(new URLSearchParams("tab=nope&role=admin")))).toBe("");
  });

  it("filters by tab, role, the no-Team card and name or email", () => {
    const base = parseUsersState(new URLSearchParams());
    expect(filterMembers(members, base).map((m) => m.id)).toEqual(["priya", "arjun", "sarah", "kavya", "marcus"]);
    expect(filterMembers(members, { ...base, tab: "deactivated" }).map((m) => m.id)).toEqual(["old"]);
    expect(filterMembers(members, { ...base, role: "owner" }).map((m) => m.id)).toEqual(["priya", "arjun"]);
    expect(filterMembers(members, { ...base, noTeam: true }).map((m) => m.id)).toEqual(["kavya"]);
    expect(filterMembers(members, { ...base, q: "MERIDIAN" }).map((m) => m.id)).toEqual(["priya", "kavya"]);
    expect(filterInvites(invites, { ...base, tab: "invites", role: "field" }).map((i) => i.id)).toEqual(["tom"]);
  });

  it("counts the cards: people by role, Staff without a Team and pending invites with how many expired", () => {
    expect(usersTotals(members, invites, NOW)).toEqual({ people: 5, peopleLabel: "2 owners · 2 staff · 1 field", noTeam: 1, invites: 2, invitesLabel: "1 expired · open Invites" });
    expect(usersTotals(members, [invites[0]!], NOW).invitesLabel).toBe("Open Invites");
  });

  it("says when someone was last active, and when they joined in the business's format", () => {
    expect(lastActiveLabel(null, NOW)).toBe("Never signed in");
    expect(lastActiveLabel(new Date(NOW - 20_000).toISOString(), NOW)).toBe("Just now");
    expect(lastActiveLabel(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5 minutes ago");
    expect(lastActiveLabel(new Date(NOW - 2 * HOUR).toISOString(), NOW)).toBe("2 hours ago");
    expect(lastActiveLabel(new Date(NOW - 30 * HOUR).toISOString(), NOW)).toBe("Yesterday");
    expect(lastActiveLabel(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe("3 days ago");
    expect(lastActiveLabel("2026-10-03T09:00:00", NOW)).toBe("Oct 3");
    expect(shortDate("2025-12-20T09:00:00", NOW)).toBe("Dec 20, 2025");
  });
});

describe("US-TEAM-20", () => {
  it("says which Teams someone is on after saving", () => {
    expect(teamsSentence("Sarah Mendes", [{ name: "General Staff" }, { name: "Accounts" }])).toBe("Sarah Mendes is on General Staff and Accounts");
    expect(teamsSentence("Kavya Iyer", [{ name: "A" }, { name: "B" }, { name: "C" }])).toBe("Kavya Iyer is on A, B and C");
    expect(teamsSentence("Kavya Iyer", [])).toBe("Kavya Iyer is on no Team — they can't open anything");
  });

  it("counts their permissions by group, over every capability", () => {
    const all = Object.fromEntries(CAPABILITIES.map((c) => [c, true]));
    const groups = capabilityGroupCounts(all);
    expect(groups.reduce((sum, g) => sum + g.total, 0)).toBe(CAPABILITIES.length);
    expect(groups.every((g) => g.granted === g.total)).toBe(true);
    const banking = capabilityGroupCounts({ "banking.view": true }).find((g) => g.group === "Banking")!;
    expect(banking).toEqual({ group: "Banking", granted: 1, total: 3 });
  });

  it("lists the sections they can open as their sidebar would", () => {
    const hrefs = (role: string, caps: Record<string, boolean> | null) => navSectionsFor(role, caps).flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs("staff", {})).not.toContain("/banking");
    expect(hrefs("staff", { "banking.view": true })).toContain("/banking");
    expect(hrefs("field", null)).toEqual(["/dashboard", "/jobs", "/meetings", "/expenses"]);
  });
});

describe("US-TEAM-21", () => {
  it("reads several emails separated by commas, spaces or new lines, once each", () => {
    expect(parseEmailList("Sam@Example.com, neha@example.com\nvikram@meridian  sam@example.com;")).toEqual(["sam@example.com", "neha@example.com", "vikram@meridian"]);
    expect(isEmailAddress("neha@example.com")).toBe(true);
    expect(isEmailAddress("vikram@meridian")).toBe(false);
  });

  it("says when an invite expires", () => {
    expect(expiresLabel(new Date(NOW + 7 * DAY - 1000).toISOString(), NOW)).toBe("Expires in 7 days");
    expect(expiresLabel(new Date(NOW + 5 * DAY + HOUR).toISOString(), NOW)).toBe("Expires in 5 days");
    expect(expiresLabel(new Date(NOW + DAY + HOUR).toISOString(), NOW)).toBe("Expires tomorrow");
    expect(expiresLabel(new Date(NOW + HOUR).toISOString(), NOW)).toBe("Expires today");
    expect(expiresLabel(new Date(NOW - HOUR).toISOString(), NOW)).toBe("Expired");
  });
});
