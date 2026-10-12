import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { invitationTeams, teamMemberships, teams } from "../db/schema";

/**
 * US-TEAM-21 (D-232) — run by Better Auth's `afterAcceptInvitation`: a
 * Staff invite's new member joins the Teams it named. Only Teams still in
 * the invite's organisation count; anything else accepts with no Teams.
 */
export async function applyInvitationTeams(db: Database, accepted: { invitationId: string; memberId: string; role: string | null | undefined; orgId: string }): Promise<void> {
  if (accepted.role !== "staff") return;
  const rows = await db
    .select({ teamId: invitationTeams.teamId })
    .from(invitationTeams)
    .innerJoin(teams, eq(teams.id, invitationTeams.teamId))
    .where(and(eq(invitationTeams.invitationId, accepted.invitationId), eq(teams.orgId, accepted.orgId)));
  if (rows.length === 0) return;
  await db
    .insert(teamMemberships)
    .values(rows.map((r) => ({ teamId: r.teamId, memberId: accepted.memberId })))
    .onConflictDoNothing();
}
