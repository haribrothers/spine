import { ForbiddenException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import type { Capability } from "@spine/shared";
import type { Database } from "../db/client";
import { member, teamMemberships, teamPrivileges } from "../db/schema";

/**
 * The same owner/field/staff resolution `CapabilityGuard` uses, factored out
 * so it can also be called directly from a service — needed for the
 * "own vs others" capability pairs (`contacts.edit_own`/`edit_others`, etc.)
 * where which capability applies depends on data (`createdByUserId`) that
 * isn't known yet at the route-guard stage, before the record is loaded.
 * `CapabilityGuard` itself now delegates here rather than duplicating this
 * logic — see that file for why a route-level guard can't express this
 * ownership check on its own.
 */
export async function hasCapability(
  db: Database,
  actor: { orgId: string; userId: string },
  capability: Capability,
): Promise<boolean> {
  const [membership] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, actor.orgId), eq(member.userId, actor.userId)));
  if (!membership) {
    return false;
  }

  if (membership.role === "owner") return true;
  if (membership.role !== "staff") {
    // Field is fixed/non-configurable — whether a Field user may reach a
    // given route at all is decided by that route's own @OrgRoles, not by
    // a Team grant (see require-capability.decorator.ts). This helper is
    // only ever asked about Staff-tier, ownership-aware capabilities
    // (contacts.edit_own/others, delete_own/others), so a non-staff role
    // reaching here has no grant to check — fail closed.
    return false;
  }

  const teamIds = await db.select({ teamId: teamMemberships.teamId }).from(teamMemberships).where(eq(teamMemberships.memberId, membership.id));
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
 */
export async function requireOwnershipCapability(
  db: Database,
  actor: { orgId: string; userId: string },
  resourceCreatedByUserId: string | null,
  capabilities: { own: Capability; others: Capability },
): Promise<void> {
  const isOwnRecord = resourceCreatedByUserId !== null && resourceCreatedByUserId === actor.userId;
  const required = isOwnRecord ? capabilities.own : capabilities.others;
  const granted = await hasCapability(db, actor, required);
  if (!granted) {
    throw new ForbiddenException(`Missing capability: ${required}`);
  }
}
