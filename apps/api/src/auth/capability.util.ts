import { capabilitiesOff } from "@spine/shared";
import { loadModules } from "../common/modules";
import { ForbiddenException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { CAPABILITIES, type Capability } from "@spine/shared";
import type { Database } from "../db/client";
import { member, teamMemberships, teamPrivileges, teams } from "../db/schema";

/**
 * Single source of truth for which `_own` capabilities Field always passes
 * for their OWN record only (see `hasCapability`'s `fieldAlwaysPasses`
 * param for the full rationale). Every
 * `requireOwnershipCapability(..., fieldAlwaysPassesOwn: true)` call site's
 * `own` capability MUST appear here, and vice versa — kept as one set
 * rather than a boolean scattered across call sites so
 * `getEffectiveCapabilities` (used by the web privilege-aware UI) can
 * answer "does Field have this capability" without re-deriving the same
 * fact a second, possibly-drifting way.
 */
export const FIELD_OWN_CAPABILITIES: ReadonlySet<Capability> = new Set([
  "expenses.edit_own",
  "expenses.delete_own",
  "job_photos.edit_own",
  "job_notes.edit_own",
] satisfies Capability[]);

/**
 * Capabilities Field always passes UNCONDITIONALLY — both `_own` and
 * `_others` — because the underlying action was never meant to be an
 * ownership question for Field in the first place. So far this is only
 * `milestones.edit_own`/`milestones.edit_others`: milestone "own" is
 * whoever last defined the milestone SET (office Staff/Owner via
 * `PUT /:id/milestones`), but completing a milestone is field-crew work
 * regardless of who defined it — Field has always been able to mark ANY
 * milestone complete (S-04.4), and this preserves that rather than
 * accidentally scoping it to "only milestones I personally defined,"
 * which no Field user would ever satisfy. Every call site passing BOTH
 * `own` and `others` capabilities from this set to `hasCapability`'s
 * `fieldAlwaysPasses` param (not `requireOwnershipCapability`'s
 * `fieldAlwaysPassesOwn`, which only covers the `own` branch) MUST have
 * both halves listed here.
 *
 * `quotes.accept_in_person` (Phase 5, S-11.7) is here too even though it's
 * a single plain capability with no own/others pair — Field is fixed/
 * non-configurable and this is the whole point of the story ("as a field
 * user, I want to present a quote and capture acceptance on site"), so it
 * must always pass for Field regardless of the Team matrix, same reasoning
 * as milestone completion. `hasCapability` calls for this capability pass
 * `fieldAlwaysPasses: true` directly rather than going through
 * `requireOwnershipCapability` (there's no ownership dimension to this
 * action at all — see `QuotesService.acceptInPerson`'s own doc comment).
 */
export const FIELD_ALWAYS_CAPABILITIES: ReadonlySet<Capability> = new Set([
  "milestones.edit_own",
  "milestones.edit_others",
  "quotes.accept_in_person",
  // US-TEAM-30 (D-235): Field's sections are fixed, never Team-closed.
  "jobs.open",
  "meetings.open",
] satisfies Capability[]);

/**
 * The same owner/field/staff resolution `CapabilityGuard` uses, factored out
 * so it can also be called directly from a service — needed for the
 * "own vs others" capability pairs (`contacts.edit_own`/`edit_others`, etc.)
 * where which capability applies depends on data (`createdByUserId`) that
 * isn't known yet at the route-guard stage, before the record is loaded.
 * `CapabilityGuard` itself now delegates here rather than duplicating this
 * logic — see that file for why a route-level guard can't express this
 * ownership check on its own.
 *
 * `fieldAlwaysPasses` (default false): Field is fixed/non-configurable per
 * PRD §2.1 and never participates in the Team privilege matrix — but a
 * handful of resources (Expenses: submit/edit/delete their OWN expense;
 * job photos/notes: add their OWN) already grant Field real write access
 * today via `@OrgRoles` alone, same
 * as Owner's blanket bypass. Passing `true` here (only ever paired with an
 * `_own` capability, never `_others` — a Field user has no path to another
 * user's record regardless) preserves that pre-existing behavior instead of
 * silently taking it away the moment ownership enforcement moves from the
 * route guard into the service. Every other call site omits this and keeps
 * failing closed for Field, matching Contacts/Catalogue/Leads/Activities/
 * Quotes/Meetings, none of which ever granted Field write access.
 */
/** The caller's role in the organisation, or null when they aren't a member. */
export async function getMemberRole(db: Database, orgId: string, userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  return membership?.role ?? null;
}

export async function hasCapability(
  db: Database,
  actor: { orgId: string; userId: string },
  capability: Capability,
  fieldAlwaysPasses = false,
): Promise<boolean> {
  const [membership] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, actor.orgId), eq(member.userId, actor.userId)));
  if (!membership) {
    return false;
  }

  if (membership.role === "owner") return true;
  if (membership.role === "field") return fieldAlwaysPasses;
  if (membership.role !== "staff") {
    // Any future fixed role beyond owner/staff/field — same reasoning as
    // field would apply once such a role exists, but nothing defines one
    // yet, so fail closed rather than assume.
    return false;
  }

  // Only Teams in this organisation count: a membership that moved between
  // organisations must never carry another organisation's grants with it.
  const teamIds = await db
    .select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(eq(teamMemberships.memberId, membership.id), eq(teams.orgId, actor.orgId)));
  if (teamIds.length === 0) return false;

  const [grant] = await db
    .select({ granted: teamPrivileges.granted })
    .from(teamPrivileges)
    .where(
      and(
        inArray(
          teamPrivileges.teamId,
          teamIds.map((t) => t.teamId),
        ),
        eq(teamPrivileges.capability, capability),
        eq(teamPrivileges.granted, true),
      ),
    )
    .limit(1);

  return Boolean(grant);
}

/**
 * The "own vs others" gate for Contacts & Catalogue (PRD §2.1, §9 S-01.15/
 * S-02.5): a record with no known creator (`resourceCreatedByUserId: null`
 * — a pre-migration legacy row, or anything else with no recorded owner) is
 * treated as unowned by anyone, so only the `others` capability can act on
 * it; `own` never applies to a `null` creator even for the acting user
 * themselves, since nobody can truthfully claim an unowned record as
 * "theirs." Throws the same `ForbiddenException` shape `CapabilityGuard`
 * throws, so callers get consistent 403 behaviour regardless of whether the
 * check happened at the route guard or inside a service method.
 *
 * `fieldAccess` (default `"none"`): `"own"` forwards `fieldAlwaysPasses` to
 * `hasCapability` only on the `own` branch (see that function's own doc
 * comment) — never applies to `others`, so a Field user still can never
 * touch a colleague's record. `"always"` forwards it on BOTH branches —
 * for the rare resource (so far only Milestones) where the action was
 * never an ownership question for Field to begin with, see
 * `FIELD_ALWAYS_CAPABILITIES`'s own doc comment.
 */
export async function requireOwnershipCapability(
  db: Database,
  actor: { orgId: string; userId: string },
  resourceCreatedByUserId: string | null,
  capabilities: { own: Capability; others: Capability },
  fieldAccess: "none" | "own" | "always" = "none",
): Promise<void> {
  const isOwnRecord = resourceCreatedByUserId !== null && resourceCreatedByUserId === actor.userId;
  const required = isOwnRecord ? capabilities.own : capabilities.others;
  const fieldAlwaysPasses = fieldAccess === "always" || (fieldAccess === "own" && isOwnRecord);
  const granted = await hasCapability(db, actor, required, fieldAlwaysPasses);
  if (!granted) {
    throw new ForbiddenException(`Missing capability: ${required}`);
  }
}

/**
 * The full effective capability set for one user in one org — every
 * `CAPABILITIES` entry mapped to whether they currently have it, unioned
 * across all their Teams (Staff) or resolved by fixed rule (Owner: all
 * `true`; Field: `true` for `FIELD_OWN_CAPABILITIES` and
 * `FIELD_ALWAYS_CAPABILITIES`, `false` otherwise — Field never touches the
 * Team privilege matrix). Backs
 * `GET /org/members/me/capabilities`, which the web privilege-aware UI
 * (`use-my-capabilities.ts`) calls once per session to decide which
 * buttons/actions to show — client-side hiding only, never the real
 * security boundary; the server independently re-checks every mutating
 * request via `CapabilityGuard`/`requireOwnershipCapability` regardless of
 * what this endpoint returned.
 *
 * One query for the Team/privilege join, not one round-trip per
 * capability — `hasCapability` is intentionally NOT reused here for
 * Staff, since calling it `CAPABILITIES.length` times would be
 * `CAPABILITIES.length` separate queries for what's really one join.
 */
/**
 * US-SET-24 (D-154) — what this member can use now: a switched-off module's
 * capabilities read as false. Their Team grants are kept (and come back with
 * the module); the module's routes are refused by `ModuleGuard` either way.
 */
export async function getEffectiveCapabilities(db: Database, actor: { orgId: string; userId: string }): Promise<Record<Capability, boolean>> {
  const granted = await grantedCapabilities(db, actor);
  const off = capabilitiesOff(await loadModules(db, actor.orgId));
  if (off.size === 0) return granted;
  return Object.fromEntries(Object.entries(granted).map(([c, on]) => [c, on && !off.has(c as Capability)])) as Record<Capability, boolean>;
}

async function grantedCapabilities(db: Database, actor: { orgId: string; userId: string }): Promise<Record<Capability, boolean>> {
  const allFalse = Object.fromEntries(CAPABILITIES.map((c) => [c, false])) as Record<Capability, boolean>;

  const [membership] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, actor.orgId), eq(member.userId, actor.userId)));
  if (!membership) {
    return allFalse;
  }

  if (membership.role === "owner") {
    return Object.fromEntries(CAPABILITIES.map((c) => [c, true])) as Record<Capability, boolean>;
  }

  if (membership.role === "field") {
    return Object.fromEntries(
      CAPABILITIES.map((c) => [c, FIELD_OWN_CAPABILITIES.has(c) || FIELD_ALWAYS_CAPABILITIES.has(c)]),
    ) as Record<Capability, boolean>;
  }

  if (membership.role !== "staff") {
    return allFalse;
  }

  // Only Teams in this organisation count: a membership that moved between
  // organisations must never carry another organisation's grants with it.
  const teamIds = await db
    .select({ teamId: teamMemberships.teamId })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(eq(teamMemberships.memberId, membership.id), eq(teams.orgId, actor.orgId)));
  if (teamIds.length === 0) {
    return allFalse;
  }

  const grantedRows = await db
    .select({ capability: teamPrivileges.capability })
    .from(teamPrivileges)
    .where(
      and(
        inArray(
          teamPrivileges.teamId,
          teamIds.map((t) => t.teamId),
        ),
        eq(teamPrivileges.granted, true),
      ),
    );
  const grantedSet = new Set(grantedRows.map((r) => r.capability));

  return Object.fromEntries(CAPABILITIES.map((c) => [c, grantedSet.has(c)])) as Record<Capability, boolean>;
}
