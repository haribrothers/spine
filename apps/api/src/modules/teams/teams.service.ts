import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Capability, TeamHistoryEntry } from "@spine/shared";
import { CAPABILITIES, CAPABILITY_LABELS, withImpliedPrivileges } from "@spine/shared";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { auditLog, member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isDemo: boolean;
  memberCount: number;
  createdAt: Date;
  /** US-TEAM-25 — who is on it, and what it grants. */
  members: { memberId: string; name: string }[];
  granted: Capability[];
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
  description: string | null;
  isDefault: boolean;
  isDemo: boolean;
  members: TeamMemberSummary[];
  privileges: Record<Capability, boolean>;
}

const onOff = (granted: boolean) => (granted ? "On" : "Off");

/**
 * PRD §2.1/§7 — Teams subdivide the Staff tier with a configurable
 * privilege matrix. Every method takes orgId first and scopes every query
 * through it (same convention as MembersService/SettingsService), so a
 * team id from another org can never be operated on even if guessed.
 * US-TEAM-29 (D-234): every change is audited as entity type `team`.
 */
@Injectable()
export class TeamsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditLogService,
  ) {}

  private async record(orgId: string, actorUserId: string | null, teamId: string, action: string, changes: { field: string; from: unknown; to: unknown }[]) {
    await this.audit.record(this.db, { orgId, actorUserId, action, entityType: "team", entityId: teamId, contactId: null, changes });
  }

  async list(orgId: string): Promise<TeamSummary[]> {
    const rows = await this.db
      .select({ id: teams.id, name: teams.name, description: teams.description, isDefault: teams.isDefault, isDemo: teams.isDemo, createdAt: teams.createdAt })
      .from(teams)
      .where(eq(teams.orgId, orgId))
      .orderBy(teams.createdAt);
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const memberRows = await this.db
      .select({ teamId: teamMemberships.teamId, memberId: member.id, name: user.name })
      .from(teamMemberships)
      .innerJoin(member, eq(member.id, teamMemberships.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(inArray(teamMemberships.teamId, ids))
      .orderBy(user.name);
    const grantRows = await this.db
      .select({ teamId: teamPrivileges.teamId, capability: teamPrivileges.capability })
      .from(teamPrivileges)
      .where(and(inArray(teamPrivileges.teamId, ids), eq(teamPrivileges.granted, true)));
    const known = new Set<string>(CAPABILITIES);
    return rows.map((r) => {
      const members = memberRows.filter((m) => m.teamId === r.id).map((m) => ({ memberId: m.memberId, name: m.name }));
      const granted = grantRows.filter((g) => g.teamId === r.id && known.has(g.capability)).map((g) => g.capability as Capability);
      return { ...r, members, memberCount: members.length, granted };
    });
  }

  /** The default Team or one being renamed keeps a name no other Team in the business has. */
  private async assertNameFree(orgId: string, name: string, exceptId?: string) {
    const [clash] = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.orgId, orgId), sql`lower(${teams.name}) = lower(${name})`, ...(exceptId ? [ne(teams.id, exceptId)] : [])));
    if (clash) throw new ConflictException(`There's already a Team called ${name}.`);
  }

  /**
   * US-TEAM-26 — a new Team, optionally starting from another's permissions
   * (never its members). A plain name still works for older callers.
   */
  async create(orgId: string, input: string | { name: string; description?: string | null; copyFromTeamId?: string }, actorUserId: string | null = null): Promise<TeamSummary> {
    const { name, description = null, copyFromTeamId } = typeof input === "string" ? { name: input } : input;
    await this.assertNameFree(orgId, name);
    const source = copyFromTeamId ? await this.requireTeam(orgId, copyFromTeamId) : null;
    const [created] = await this.db.insert(teams).values({ orgId, name, description: description || null }).returning();
    if (!created) throw new BadRequestException("Failed to create team");
    if (source) {
      const grants = await this.db.select({ capability: teamPrivileges.capability, granted: teamPrivileges.granted }).from(teamPrivileges).where(eq(teamPrivileges.teamId, source.id));
      if (grants.length) await this.db.insert(teamPrivileges).values(grants.map((g) => ({ teamId: created.id, capability: g.capability, granted: g.granted })));
    }
    await this.record(orgId, actorUserId, created.id, "created", [
      { field: "name", from: null, to: created.name },
      ...(source ? [{ field: "copiedFrom", from: null, to: source.name }] : []),
    ]);
    return (await this.list(orgId)).find((t) => t.id === created.id)!;
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

    return { id: team.id, name: team.name, description: team.description, isDefault: team.isDefault, isDemo: team.isDemo, members: memberRows, privileges };
  }

  /** US-TEAM-26 — name and description; the default Team keeps its name. */
  async update(orgId: string, teamId: string, input: { name?: string; description?: string | null }, actorUserId: string | null = null): Promise<TeamSummary> {
    const team = await this.requireTeam(orgId, teamId);
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    const set: { name?: string; description?: string | null } = {};
    if (input.name !== undefined && input.name !== team.name) {
      if (team.isDefault) throw new BadRequestException("The default Team's name can't change.");
      await this.assertNameFree(orgId, input.name, teamId);
      set.name = input.name;
      changes.push({ field: "name", from: team.name, to: input.name });
    }
    if (input.description !== undefined && (input.description || null) !== team.description) {
      set.description = input.description || null;
      changes.push({ field: "description", from: team.description, to: set.description });
    }
    if (changes.length) {
      await this.db.update(teams).set(set).where(eq(teams.id, teamId));
      await this.record(orgId, actorUserId, teamId, "updated", changes);
    }
    return (await this.list(orgId)).find((t) => t.id === teamId)!;
  }

  /** The original rename, kept for callers that only change the name. */
  async rename(orgId: string, teamId: string, name: string, actorUserId: string | null = null): Promise<TeamSummary> {
    return this.update(orgId, teamId, { name }, actorUserId);
  }

  async delete(orgId: string, teamId: string, actorUserId: string | null = null): Promise<void> {
    const team = await this.requireTeam(orgId, teamId);
    if (team.isDefault) {
      throw new BadRequestException("The default team cannot be deleted");
    }
    const orgTeams = await this.db.select({ id: teams.id }).from(teams).where(eq(teams.orgId, orgId));
    if (orgTeams.length <= 1) {
      throw new BadRequestException("Cannot delete an organisation's only team");
    }
    const members = (await this.getDetail(orgId, teamId)).members.map((m) => m.name);
    await this.db.delete(teams).where(eq(teams.id, teamId));
    await this.record(orgId, actorUserId, teamId, "deleted", [
      { field: "name", from: team.name, to: null },
      ...(members.length ? [{ field: "members", from: members.join(", "), to: null }] : []),
    ]);
  }

  async setPrivileges(
    orgId: string,
    teamId: string,
    privileges: { capability: Capability; granted: boolean }[],
    actorUserId: string | null = null,
  ): Promise<Record<Capability, boolean>> {
    await this.requireTeam(orgId, teamId);
    const before = (await this.getDetail(orgId, teamId)).privileges;

    // US-BANK-12: e.g. reconciling turns on seeing balances, and turning that off turns reconciling off.
    for (const { capability, granted } of withImpliedPrivileges(privileges)) {
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
    const after = Object.fromEntries(
      CAPABILITIES.map((capability) => [capability, grantedByCapability.get(capability) ?? false]),
    ) as Record<Capability, boolean>;
    // US-TEAM-29: what actually changed, by label.
    const changed = CAPABILITIES.filter((c) => before[c] !== after[c]).map((c) => ({ field: CAPABILITY_LABELS[c].label, from: onOff(before[c]), to: onOff(after[c]) }));
    if (changed.length) await this.record(orgId, actorUserId, teamId, "privileges_changed", changed);
    return after;
  }

  async setMembers(orgId: string, teamId: string, memberIds: string[], actorUserId: string | null = null): Promise<void> {
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

    const before = (await this.getDetail(orgId, teamId)).members;
    await this.db.transaction(async (tx) => {
      await tx.delete(teamMemberships).where(eq(teamMemberships.teamId, teamId));
      if (memberIds.length > 0) {
        await tx.insert(teamMemberships).values(memberIds.map((memberId) => ({ teamId, memberId })));
      }
    });
    const after = (await this.getDetail(orgId, teamId)).members;
    const beforeIds = new Set(before.map((m) => m.memberId));
    const afterIds = new Set(after.map((m) => m.memberId));
    const added = after.filter((m) => !beforeIds.has(m.memberId)).map((m) => m.name);
    const removed = before.filter((m) => !afterIds.has(m.memberId)).map((m) => m.name);
    if (added.length || removed.length) {
      await this.record(orgId, actorUserId, teamId, "members_changed", [
        ...(added.length ? [{ field: "added", from: null, to: added.join(", ") }] : []),
        ...(removed.length ? [{ field: "removed", from: removed.join(", "), to: null }] : []),
      ]);
    }
  }

  /** US-TEAM-29 — the Team's audit entries, newest first. */
  async history(orgId: string, teamId: string): Promise<TeamHistoryEntry[]> {
    await this.requireTeam(orgId, teamId);
    const rows = await this.db
      .select({ at: auditLog.createdAt, actorName: user.name, action: auditLog.action, changes: auditLog.changes })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorUserId))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "team"), eq(auditLog.entityId, teamId)))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    return rows.map((r) => ({ at: r.at.toISOString(), actorName: r.actorName, action: r.action, changes: (r.changes as TeamHistoryEntry["changes"]) ?? null }));
  }

  async getMemberTeams(orgId: string, memberId: string): Promise<Omit<TeamSummary, "members" | "granted" | "description" | "isDemo">[]> {
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
