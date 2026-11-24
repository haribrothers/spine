import { CAPABILITIES, DEFAULT_TEAM_GRANTS, DEFAULT_TEAM_NAME } from "@spine/shared";
import type { Database } from "../client";
import { teamPrivileges, teams } from "../schema";

/**
 * Every fresh org gets one seeded Team so a newly invited Staff user has
 * sensible access with zero extra owner setup (PRD §2.1/S-10.13-14).
 * DEFAULT_TEAM_GRANTS is the single source of truth for these grants — the
 * hand-authored backfill migration (0022_backfill_primary_owner_and_default_team.sql)
 * hardcodes the same values for pre-existing orgs since SQL can't import
 * this constant; keep both in sync if these defaults ever change.
 */
export async function seedDefaultTeam(db: Database, orgId: string): Promise<void> {
  const [team] = await db
    .insert(teams)
    .values({ orgId, name: DEFAULT_TEAM_NAME, isDefault: true })
    .returning({ id: teams.id });
  if (!team) {
    throw new Error(`Failed to seed default team for org ${orgId}`);
  }

  await db.insert(teamPrivileges).values(
    CAPABILITIES.map((capability) => ({
      teamId: team.id,
      capability,
      granted: DEFAULT_TEAM_GRANTS[capability],
    })),
  );
}
