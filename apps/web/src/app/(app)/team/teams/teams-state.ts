import { CAPABILITIES, CAPABILITY_LABELS, CAPABILITY_REQUIRES, SECTION_OPEN_CAPABILITIES, capabilitiesOff, withImpliedPrivileges, type Capability, type ModuleSettings } from "@spine/shared";
import type { MemberRow } from "../../../../lib/members";
import { sectionAccessFor, type SectionAccess } from "../../../../lib/nav-sections";
import type { TeamPrivileges, TeamSummary } from "../../../../lib/teams";

/** US-TEAM-25 (D-234) — the list's search, kept in the address (`?q=`). */
export function filterTeams(rows: TeamSummary[], q: string): TeamSummary[] {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((t) => `${t.name} ${t.description ?? ""}`.toLowerCase().includes(needle)) : rows;
}

/**
 * Where a Team's members stand in each section of Spine with these grants
 * (before any other Team adds to them): work there, only view it, or can't
 * open it — and how many sections they work in, out of every section the
 * business uses.
 */
export function sectionsOpened(granted: Iterable<string>, modules: ModuleSettings | null) {
  const caps = Object.fromEntries([...granted].map((c) => [c, true])) as Partial<Record<Capability, boolean>>;
  const all = sectionAccessFor("staff", caps, modules);
  return { all, works: all.filter((s) => s.access === "work").length, total: all.length };
}

const ACCESS_RANK: Record<SectionAccess, number> = { none: 0, view: 1, work: 2 };

/** Sections whose access the draft raises or lowers, with the new access. */
export function sectionChanges(before: ReturnType<typeof sectionsOpened>, after: ReturnType<typeof sectionsOpened>) {
  return after.all
    .map((s) => ({ ...s, was: before.all.find((b) => b.href === s.href)?.access ?? "none" }))
    .filter((s) => s.was !== s.access)
    .map((s) => ({ ...s, up: ACCESS_RANK[s.access] > ACCESS_RANK[s.was] }));
}

/** "38 of 105" — over the permissions the business's modules use (US-SET-24). */
export function permissionCount(granted: Iterable<string>, modules: ModuleSettings | null) {
  const off = capabilitiesOff(modules);
  const shown = CAPABILITIES.filter((c) => !off.has(c));
  const on = new Set(granted);
  return { granted: shown.filter((c) => on.has(c)).length, total: shown.length };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The cards: Teams, Staff on no Team and Staff on several Teams. */
export function teamsTotals(rows: TeamSummary[], members: MemberRow[]) {
  const staff = members.filter((m) => m.role === "staff" && m.isActive);
  const teamCount = new Map<string, number>();
  for (const t of rows) for (const m of t.members) teamCount.set(m.memberId, (teamCount.get(m.memberId) ?? 0) + 1);
  const noTeam = staff.filter((m) => !teamCount.get(m.id));
  const several = staff.filter((m) => (teamCount.get(m.id) ?? 0) > 1);
  const empty = rows.filter((t) => t.members.length === 0).length;
  return {
    teams: rows.length,
    teamsLabel: [rows.some((t) => t.isDefault) ? "1 default" : null, empty ? `${empty} with no one yet` : null].filter(Boolean).join(" · ") || "—",
    noTeam: noTeam.length,
    noTeamLabel: noTeam.length === 0 ? "everyone can work" : noTeam.length === 1 ? `${noTeam[0]!.name} · open in Users` : `${plural(noTeam.length, "person", "people")} · open in Users`,
    several: several.length,
  };
}

/** Who'd be left on no Team if this Team went (or they came off it). */
export function leftWithoutTeam(teamId: string, memberIds: string[], rows: TeamSummary[]): string[] {
  return memberIds.filter((id) => !rows.some((t) => t.id !== teamId && t.members.some((m) => m.memberId === id)));
}

export function peopleLabel(n: number): string {
  return n === 0 ? "No one yet" : plural(n, "person", "people");
}

// ---------- Permissions draft (US-TEAM-28) ----------

/** The draft after switching one permission or a group, with the ones that come with it (US-BANK-12). */
export function applyToDraft(draft: TeamPrivileges, changes: { capability: Capability; granted: boolean }[]): TeamPrivileges {
  const next = { ...draft };
  for (const { capability, granted } of withImpliedPrivileges(changes)) next[capability] = granted;
  return next;
}

/** What differs between the saved permissions and the draft, in the matrix's order. */
export function draftChanges(saved: TeamPrivileges, draft: TeamPrivileges): { capability: Capability; granted: boolean }[] {
  return CAPABILITIES.filter((c) => (saved[c] ?? false) !== (draft[c] ?? false)).map((c) => ({ capability: c, granted: draft[c] ?? false }));
}

/** "Reconciling needs to see the account." for a change that came with another, else null. */
export function changeReason(capability: Capability, granted: boolean, changes: { capability: Capability; granted: boolean }[]): string | null {
  if (granted) {
    const needer = changes.find((c) => c.granted && CAPABILITY_REQUIRES[c.capability]?.requires.includes(capability));
    return needer ? (CAPABILITY_REQUIRES[needer.capability]?.reason ?? null) : null;
  }
  const rule = CAPABILITY_REQUIRES[capability];
  return rule && changes.some((c) => !c.granted && rule.requires.includes(c.capability)) ? rule.reason : null;
}

// ---------- Sections (US-TEAM-30, US-TEAM-32, D-235) ----------

const OPEN_CAPABILITIES = new Set<Capability>(SECTION_OPEN_CAPABILITIES.map((s) => s.capability));

/**
 * The Sections card: one switch per section that has an Open permission
 * (Expenses always opens — "See everyone's expenses" stays in its group),
 * for the switched-on modules, with where members stand there.
 */
export function sectionSwitches(draft: TeamPrivileges, modules: ModuleSettings | null) {
  const off = capabilitiesOff(modules);
  const access = sectionsOpened(Object.entries(draft).filter(([, on]) => on).map(([c]) => c), modules).all;
  return SECTION_OPEN_CAPABILITIES.filter((s) => s.href !== "/expenses" && !off.has(s.capability) && access.some((a) => a.href === s.href)).map((s) => ({
    ...s,
    on: draft[s.capability] ?? false,
    access: access.find((a) => a.href === s.href)!.access,
  }));
}

/** "Open Quotes first." while a permission's section is closed in the draft, else null. */
export function waitsFor(capability: Capability, draft: TeamPrivileges): string | null {
  const open = CAPABILITY_REQUIRES[capability]?.requires.find((r) => OPEN_CAPABILITIES.has(r) && !draft[r]);
  if (!open) return null;
  const label = CAPABILITY_LABELS[open].label;
  return label.startsWith("Open ") ? `${label} first.` : `Turn on “${label}” first.`;
}

/** The save confirm's line for a section the draft opens, closes or changes. */
export function sectionChangeLine(was: SectionAccess, access: SectionAccess): string {
  if (access === "none") return "They'll no longer see";
  if (was === "none") return "They'll see";
  return access === "work" ? "They'll work in" : "They'll only view";
}

/** Groups in the matrix's order, for the switched-on modules (US-SET-24). */
export function permissionGroups(modules: ModuleSettings | null): { label: string; capabilities: Capability[] }[] {
  const off = capabilitiesOff(modules);
  const groups: { label: string; capabilities: Capability[] }[] = [];
  for (const capability of CAPABILITIES) {
    if (off.has(capability)) continue;
    const label = CAPABILITY_LABELS[capability].group ?? "Other";
    const group = groups.find((g) => g.label === label);
    if (group) group.capabilities.push(capability);
    else groups.push({ label, capabilities: [capability] });
  }
  return groups;
}

/** Permissions whose label or description contains the search. */
export function matchesSearch(capability: Capability, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const l = CAPABILITY_LABELS[capability];
  return `${l.label} ${l.description}`.toLowerCase().includes(needle);
}
