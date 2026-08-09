import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Capability } from "@spine/shared";
import { CAPABILITIES } from "@spine/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";

export interface TeamSummary {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  createdAt: Date;
}

export interface TeamMemberSummary {
  memberId: string;
  userId: string;
  name: string;
  email: string;
}

export interface TeamDetail {
  id: string;
  name: string;
  isDefault: boolean;
  members: TeamMemberSummary[];
  privileges: Record<Capability, boolean>;
}

/**
 * PRD §2.1/§7 — Teams subdivide the Staff tier with a configurable
 * privilege matrix. Every method takes orgId first and scopes every query
 * through it (same convention as MembersService/SettingsService), so a
 * team id from another org can never be operated on even if guessed.
 */
@Injectable()
export class TeamsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string): Promise<TeamSummary[]> {
    const rows = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        isDefault: teams.isDefault,
        createdAt: teams.createdAt,
        memberCount: sql<number>`count(${teamMemberships.id})::int`,
      })
      .from(teams)
      .leftJoin(teamMemberships, eq(teamMemberships.teamId, teams.id))
      .where(eq(teams.orgId, orgId))
      .groupBy(teams.id)
      .orderBy(teams.createdAt);

    return rows;
  }

  async create(orgId: string, name: string): Promise<TeamSummary> {
    const [created] = await this.db.insert(teams).values({ orgId, name }).returning();
    if (!created) {
      throw new BadRequestException("Failed to create team");
    }
    return { id: created.id, name: created.name, isDefault: created.isDefault, memberCount: 0, createdAt: created.createdAt };
  }

  private async requireTeam(orgId: string, teamId: string) {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.orgId, orgId), eq(teams.id, teamId)));
    if (!team) {
      throw new BadRequestException("Team not found");
    }
    return team;
  }

  async getDetail(orgId: string, teamId: string): Promise<TeamDetail> {
    const team = await this.requireTeam(orgId, teamId);

    const memberRows = await this.db
      .select({
        memberId: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
      })
      .from(teamMemberships)
      .innerJoin(member, eq(member.id, teamMemberships.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(teamMemberships.teamId, teamId));

    const privilegeRows = await this.db
      .select({ capability: teamPrivileges.capability, granted: teamPrivileges.granted })
      .from(teamPrivileges)
      .where(eq(teamPrivileges.teamId, teamId));
    const grantedByCapability = new Map(privilegeRows.map((row) => [row.capability, row.granted]));

    // Unset rows default to false — a team with no explicit row for a
    // capability grants nothing for it, matching setPrivileges' upsert
    // semantics below (only rows explicitly written exist at all).
    const privileges = Object.fromEntries(
      CAPABILITIES.map((capability) => [capability, grantedByCapability.get(capability) ?? false]),
    ) as Record<Capability, boolean>;

    return { id: team.id, name: team.name, isDefault: team.isDefault, members: memberRows, privileges };
  }

  async rename(orgId: string, teamId: string, name: string): Promise<TeamSummary> {
    await this.requireTeam(orgId, teamId);
    const [updated] = await this.db.update(teams).set({ name }).where(eq(teams.id, teamId)).returning();
    const [countRow] = await this.db
      .select({ memberCount: sql<number>`count(*)::int` })
      .from(teamMemberships)
      .where(eq(teamMemberships.teamId, teamId));
    return {
      id: updated!.id,
      name: updated!.name,
      isDefault: updated!.isDefault,
      memberCount: countRow?.memberCount ?? 0,
      createdAt: updated!.createdAt,
    };
  }

  async delete(orgId: string, teamId: string): Promise<void> {
    const team = await this.requireTeam(orgId, teamId);
    if (team.isDefault) {
      throw new BadRequestException("The default team cannot be deleted");
    }
    const orgTeams = await this.db.select({ id: teams.id }).from(teams).where(eq(teams.orgId, orgId));
    if (orgTeams.length <= 1) {
      throw new BadRequestException("Cannot delete an organisation's only team");
    }
    await this.db.delete(teams).where(eq(teams.id, teamId));
  }

  async setPrivileges(
    orgId: string,
    teamId: string,
    privileges: { capability: Capability; granted: boolean }[],
  ): Promise<Record<Capability, boolean>> {
    await this.requireTeam(orgId, teamId);

    for (const { capability, granted } of privileges) {
      await this.db
        .insert(teamPrivileges)
        .values({ teamId, capability, granted })
        .onConflictDoUpdate({
          target: [teamPrivileges.teamId, teamPrivileges.capability],
          set: { granted },
        });
    }

    const rows = await this.db
      .select({ capability: teamPrivileges.capability, granted: teamPrivileges.granted })
      .from(teamPrivileges)
      .where(eq(teamPrivileges.teamId, teamId));
    const grantedByCapability = new Map(rows.map((row) => [row.capability, row.granted]));
    return Object.fromEntries(
      CAPABILITIES.map((capability) => [capability, grantedByCapability.get(capability) ?? false]),
    ) as Record<Capability, boolean>;
  }

  async setMembers(orgId: string, teamId: string, memberIds: string[]): Promise<void> {
    await this.requireTeam(orgId, teamId);

    if (memberIds.length > 0) {
      const validMembers = await this.db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.role, "staff"), inArray(member.id, memberIds)));
      if (validMembers.length !== memberIds.length) {
        throw new BadRequestException("One or more memberIds are invalid, not in this org, or not a Staff-role member");
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(teamMemberships).where(eq(teamMemberships.teamId, teamId));
      if (memberIds.length > 0) {
        await tx.insert(teamMemberships).values(memberIds.map((memberId) => ({ teamId, memberId })));
      }
    });
  }

  async getMemberTeams(orgId: string, memberId: string): Promise<TeamSummary[]> {
    const rows = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        isDefault: teams.isDefault,
        createdAt: teams.createdAt,
        memberCount: sql<number>`count(${teamMemberships.id}) over (partition by ${teams.id})::int`,
      })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(and(eq(teams.orgId, orgId), eq(teamMemberships.memberId, memberId)));
    return rows;
  }
}
