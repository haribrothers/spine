import { orgMoneySettings } from "../../common/money-format";
import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import type { MemberAccess, MemberTeamRef } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, organization, session as sessionTable, teamMemberships, teams, user } from "../../db/schema";
import { getEffectiveCapabilities } from "../../auth/capability.util";
import { AuditLogService } from "../audit/audit-log.service";

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isPrimaryOwner: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
}

/** US-TEAM-19 — what an Owner sees on each row: their Teams, when they were last active and whether they're demo data. */
export interface MemberDetailRow extends MemberRow {
  teams: MemberTeamRef[];
  lastActiveAt: Date | null;
  isDemo: boolean;
}

const ONLY_STAFF_AND_FIELD = "Only Staff and Field can be changed this way.";

/**
 * Settings' member list (S-10.2) + deactivate/reactivate (S-10.3). Structural
 * twin of AccountsService per the task brief: a list query plus per-row
 * mutations, both org-scoped. No listing endpoint existed anywhere before
 * this — onboarding's invite-team-step only ever wrote invitations, never
 * read members back.
 */
@Injectable()
export class MembersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditLogService,
  ) {}

  /** US-SET-11 — role and access changes land in the audit log as record type "User", the member's user id as the record. */
  private async recordUserChange(orgId: string, actorUserId: string | null, targetUserId: string, action: string, field: string, from: string, to: string) {
    await this.audit.record(this.db, { orgId, actorUserId, action, entityType: "user", entityId: targetUserId, contactId: null, changes: [{ field, from, to }] });
  }

  private readonly memberRowSelection = {
    id: member.id,
    userId: member.userId,
    name: user.name,
    email: user.email,
    role: member.role,
    isActive: member.isActive,
    isPrimaryOwner: member.isPrimaryOwner,
    deactivatedAt: member.deactivatedAt,
    createdAt: member.createdAt,
  };

  async list(orgId: string): Promise<MemberRow[]> {
    const rows = await this.db
      .select(this.memberRowSelection)
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));

    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * US-TEAM-19 (D-232) — the list as an Owner sees it on Users. Last active
   * is the newest use of any of their sessions (Better Auth moves
   * `updatedAt` along as a session is used).
   */
  async listDetailed(orgId: string): Promise<MemberDetailRow[]> {
    const rows = await this.db
      .select({ ...this.memberRowSelection, isDemo: member.isDemo })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));
    if (rows.length === 0) return [];
    const teamsByMember = await this.teamsFor(orgId, rows.map((r) => r.id));
    const lastActive = new Map(
      (
        await this.db
          .select({ userId: sessionTable.userId, at: max(sessionTable.updatedAt) })
          .from(sessionTable)
          .where(inArray(sessionTable.userId, rows.map((r) => r.userId)))
          .groupBy(sessionTable.userId)
      ).map((r) => [r.userId, r.at]),
    );
    return rows
      .map((r) => ({ ...r, teams: teamsByMember.get(r.id) ?? [], lastActiveAt: lastActive.get(r.userId) ?? null }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /** Whether this user is an Owner here — Users' extra fields are for Owners only. */
  async isOwner(orgId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    return row?.role === "owner";
  }

  /** Each member's Teams in this organisation, by name. */
  private async teamsFor(orgId: string, memberIds: string[]): Promise<Map<string, MemberTeamRef[]>> {
    const rows = await this.db
      .select({ memberId: teamMemberships.memberId, id: teams.id, name: teams.name })
      .from(teamMemberships)
      .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
      .where(and(eq(teams.orgId, orgId), inArray(teamMemberships.memberId, memberIds)))
      .orderBy(desc(teams.isDefault), teams.createdAt);
    const result = new Map<string, MemberTeamRef[]>();
    for (const row of rows) result.set(row.memberId, [...(result.get(row.memberId) ?? []), { id: row.id, name: row.name }]);
    return result;
  }

  /** The Teams with these ids, all in this organisation, or 400. */
  private async requireTeams(orgId: string, teamIds: string[]): Promise<MemberTeamRef[]> {
    const unique = [...new Set(teamIds)];
    if (unique.length === 0) return [];
    const rows = await this.db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(and(eq(teams.orgId, orgId), inArray(teams.id, unique)))
      .orderBy(desc(teams.isDefault), teams.createdAt);
    if (rows.length !== unique.length) throw new BadRequestException("One or more Teams weren't found. Refresh and try again.");
    return rows;
  }

  private async defaultTeamIds(orgId: string): Promise<string[]> {
    const rows = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true)));
    return rows.map((r) => r.id);
  }

  /** Replaces a member's Teams, inside the caller's transaction. */
  private async replaceTeams(tx: Pick<Database, "delete" | "insert">, memberId: string, teamIds: string[]) {
    await tx.delete(teamMemberships).where(eq(teamMemberships.memberId, memberId));
    if (teamIds.length > 0) await tx.insert(teamMemberships).values(teamIds.map((teamId) => ({ teamId, memberId })));
  }

  private async detailRow(orgId: string, memberId: string): Promise<MemberDetailRow> {
    const row = (await this.listDetailed(orgId)).find((r) => r.id === memberId);
    if (!row) throw new BadRequestException("Member not found");
    return row;
  }

  /** US-TEAM-20 — sets the Teams a Staff member is on; the change is in the audit log. */
  async setTeams(orgId: string, memberId: string, teamIds: string[], actorUserId: string | null = null): Promise<MemberDetailRow> {
    const existing = await this.requireMember(orgId, memberId);
    if (existing.role !== "staff") throw new BadRequestException("Only Staff are on Teams.");
    const next = await this.requireTeams(orgId, teamIds);
    const before = (await this.teamsFor(orgId, [memberId])).get(memberId) ?? [];
    await this.db.transaction(async (tx) => {
      await this.replaceTeams(tx, memberId, next.map((t) => t.id));
    });
    const names = (list: MemberTeamRef[]) => list.map((t) => t.name).join(", ") || "No Team";
    if (names(before) !== names(next)) await this.recordUserChange(orgId, actorUserId, existing.userId, "teams_changed", "teams", names(before), names(next));
    return this.detailRow(orgId, memberId);
  }

  /** US-TEAM-20 — what a member can open: the same effective list the API enforces for them. */
  async access(orgId: string, memberId: string): Promise<MemberAccess> {
    const existing = await this.requireMember(orgId, memberId);
    const teamsList = existing.role === "staff" ? ((await this.teamsFor(orgId, [memberId])).get(memberId) ?? []) : [];
    const capabilities = await getEffectiveCapabilities(this.db, { orgId, userId: existing.userId });
    return { role: existing.role as MemberAccess["role"], teams: teamsList, capabilities };
  }

  /**
   * US-TEAM-22 — Staff ↔ Field. To Field takes them off their Teams (Field
   * never uses them); to Staff puts them on the Teams given, or the default
   * Team when none are named. Owner is never set or left this way.
   */
  async changeRole(orgId: string, memberId: string, role: "staff" | "field", teamIds: string[] | undefined, actorUserId: string | null = null): Promise<MemberDetailRow> {
    const existing = await this.requireMember(orgId, memberId);
    if (existing.role !== "staff" && existing.role !== "field") throw new BadRequestException(ONLY_STAFF_AND_FIELD);
    if (existing.role === role) throw new BadRequestException(`They're already ${role === "staff" ? "Staff" : "Field"}.`);
    const nextTeams = role === "staff" ? await this.requireTeams(orgId, teamIds ?? (await this.defaultTeamIds(orgId))) : [];
    await this.db.transaction(async (tx) => {
      await tx.update(member).set({ role }).where(eq(member.id, memberId));
      await this.replaceTeams(tx, memberId, nextTeams.map((t) => t.id));
    });
    const label = (r: string) => (r === "staff" ? "Staff" : "Field");
    await this.recordUserChange(orgId, actorUserId, existing.userId, "role_changed", "role", label(existing.role), label(role));
    return this.detailRow(orgId, memberId);
  }

  /**
   * The caller's own membership row for the active org. Role is never
   * cached on the session (Better Auth resolves it fresh per-request via
   * getActiveMember), so this is the endpoint the web app calls to decide
   * whether to show the Owner-only Users/Teams nav section — hiding a nav
   * link is not access control, but it's still useful UI signal, and every
   * `team/*` page independently re-checks this server-side too.
   */
  async getMe(orgId: string, userId: string): Promise<MemberRow & { organizationName: string; currency: string; locale: string; mustChangePassword: boolean }> {
    // `organizationName` — US-MOB-02: the field app's Profile shows "Field · <Business>".
    // `currency`/`locale` — US-MOB-03: the phone formats money and dates the business's way.
    const [row] = await this.db
      .select({ ...this.memberRowSelection, organizationName: organization.name, mustChangePassword: user.mustChangePassword })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    if (!row) {
      throw new BadRequestException("Not a member of this organisation");
    }
    return { ...row, ...(await orgMoneySettings(this.db, orgId)) };
  }

  private async getRow(memberId: string): Promise<MemberRow> {
    const [row] = await this.db
      .select(this.memberRowSelection)
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.id, memberId));
    if (!row) {
      throw new BadRequestException("Member not found");
    }
    return row;
  }

  private async requireMember(orgId: string, memberId: string) {
    const [existing] = await this.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)));
    if (!existing) {
      throw new BadRequestException("Member not found");
    }
    return existing;
  }

  async setActive(orgId: string, memberId: string, isActive: boolean, actorUserId: string | null = null): Promise<MemberRow> {
    const existing = await this.requireMember(orgId, memberId);

    // US-TEAM-23 — nobody locks themselves out from Users.
    if (!isActive && actorUserId && existing.userId === actorUserId) {
      throw new BadRequestException("You can't deactivate yourself.");
    }

    if (existing.role === "owner" && !isActive) {
      if (existing.isPrimaryOwner) {
        throw new BadRequestException("The Primary Owner cannot be deactivated. Transfer primary ownership first.");
      }
      // Deactivating the sole owner would lock the org out of every
      // owner-only endpoint (including this one) — not enforced here as a
      // "last owner" count check since multi-owner orgs are allowed, but a
      // single self-deactivation attempt is rejected outright as unsafe.
      const owners = await this.db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.role, "owner"), eq(member.isActive, true)));
      if (owners.length <= 1) {
        throw new BadRequestException("Cannot deactivate the only active owner");
      }
    }

    const [updated] = await this.db
      .update(member)
      .set({ isActive, deactivatedAt: isActive ? null : new Date() })
      .where(eq(member.id, memberId))
      .returning();
    if (existing.isActive !== isActive) {
      await this.recordUserChange(orgId, actorUserId, existing.userId, isActive ? "reactivated" : "deactivated", "status", existing.isActive ? "Active" : "Deactivated", isActive ? "Active" : "Deactivated");
    }

    return this.getRow(updated!.id);
  }

  /** Staff -> Owner. No Team involvement — Owner is never Team-configurable. */
  async promote(orgId: string, memberId: string, actorUserId: string | null = null): Promise<MemberRow> {
    const existing = await this.requireMember(orgId, memberId);
    if (existing.role !== "staff") {
      throw new BadRequestException("Only a Staff member can be promoted to Owner");
    }
    const [updated] = await this.db.update(member).set({ role: "owner" }).where(eq(member.id, memberId)).returning();
    await this.recordUserChange(orgId, actorUserId, existing.userId, "role_changed", "role", "Staff", "Owner");
    return this.getRow(updated!.id);
  }

  /**
   * Owner -> Staff. Always rejects demoting the Primary Owner regardless of
   * caller or how many other owners exist — distinct from setActive's sole
   * remaining owner count check, which only blocks removing the LAST owner.
   * Does not auto-assign any Team — matches "no Team = no capabilities
   * until reassigned" (PRD §2.1).
   */
  async demote(orgId: string, memberId: string, actorUserId: string | null = null): Promise<MemberRow> {
    const existing = await this.requireMember(orgId, memberId);
    if (existing.role !== "owner") {
      throw new BadRequestException("Only an Owner can be demoted to Staff");
    }
    if (existing.isPrimaryOwner) {
      throw new BadRequestException("The Primary Owner cannot be demoted. Transfer primary ownership first.");
    }
    const owners = await this.db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.role, "owner"), eq(member.isActive, true)));
    if (owners.length <= 1) {
      throw new BadRequestException("Cannot demote the only active owner");
    }

    const [updated] = await this.db.update(member).set({ role: "staff" }).where(eq(member.id, memberId)).returning();
    await this.recordUserChange(orgId, actorUserId, existing.userId, "role_changed", "role", "Owner", "Staff");
    return this.getRow(updated!.id);
  }

  /**
   * Only the CURRENT Primary Owner may transfer their own status — not just
   * any Owner. The successor must already be role "owner". Both flag flips
   * happen in one transaction so the partial-unique-index invariant is
   * never even transiently violated in a way the DB would reject.
   */
  async transferPrimaryOwner(orgId: string, callerUserId: string, newPrimaryOwnerMemberId: string): Promise<void> {
    const [caller] = await this.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, callerUserId)));
    if (!caller || !caller.isPrimaryOwner) {
      throw new ForbiddenException("Only the current Primary Owner can transfer primary ownership");
    }

    const target = await this.requireMember(orgId, newPrimaryOwnerMemberId);
    if (target.role !== "owner") {
      throw new BadRequestException("Primary ownership can only be transferred to an existing Owner");
    }
    if (target.id === caller.id) {
      throw new BadRequestException("Cannot transfer primary ownership to yourself");
    }

    const names = new Map(
      (await this.db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [caller.userId, target.userId]))).map((u) => [u.id, u.name]),
    );
    await this.db.transaction(async (tx) => {
      await tx.update(member).set({ isPrimaryOwner: false }).where(eq(member.id, caller.id));
      await tx.update(member).set({ isPrimaryOwner: true }).where(eq(member.id, target.id));
      await this.audit.record(tx, {
        orgId,
        actorUserId: callerUserId,
        action: "primary_owner_transferred",
        entityType: "user",
        entityId: target.userId,
        contactId: null,
        changes: [{ field: "primaryOwner", from: names.get(caller.userId) ?? "", to: names.get(target.userId) ?? "" }],
      });
    });
  }
}
