import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { member, user } from "../../db/schema";

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

/**
 * Settings' member list (S-10.2) + deactivate/reactivate (S-10.3). Structural
 * twin of AccountsService per the task brief: a list query plus per-row
 * mutations, both org-scoped. No listing endpoint existed anywhere before
 * this — onboarding's invite-team-step only ever wrote invitations, never
 * read members back.
 */
@Injectable()
export class MembersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

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
   * The caller's own membership row for the active org. Role is never
   * cached on the session (Better Auth resolves it fresh per-request via
   * getActiveMember), so this is the endpoint the web app calls to decide
   * whether to show the Owner-only Users/Teams nav section — hiding a nav
   * link is not access control, but it's still useful UI signal, and every
   * `team/*` page independently re-checks this server-side too.
   */
  async getMe(orgId: string, userId: string): Promise<MemberRow> {
    const [row] = await this.db
      .select(this.memberRowSelection)
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    if (!row) {
      throw new BadRequestException("Not a member of this organisation");
    }
    return row;
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

  async setActive(orgId: string, memberId: string, isActive: boolean): Promise<MemberRow> {
    const existing = await this.requireMember(orgId, memberId);

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

    return this.getRow(updated!.id);
  }

  /** Staff -> Owner. No Team involvement — Owner is never Team-configurable. */
  async promote(orgId: string, memberId: string): Promise<MemberRow> {
    const existing = await this.requireMember(orgId, memberId);
    if (existing.role !== "staff") {
      throw new BadRequestException("Only a Staff member can be promoted to Owner");
    }
    const [updated] = await this.db.update(member).set({ role: "owner" }).where(eq(member.id, memberId)).returning();
    return this.getRow(updated!.id);
  }

  /**
   * Owner -> Staff. Always rejects demoting the Primary Owner regardless of
   * caller or how many other owners exist — distinct from setActive's sole
   * remaining owner count check, which only blocks removing the LAST owner.
   * Does not auto-assign any Team — matches "no Team = no capabilities
   * until reassigned" (PRD §2.1).
   */
  async demote(orgId: string, memberId: string): Promise<MemberRow> {
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

    await this.db.transaction(async (tx) => {
      await tx.update(member).set({ isPrimaryOwner: false }).where(eq(member.id, caller.id));
      await tx.update(member).set({ isPrimaryOwner: true }).where(eq(member.id, target.id));
    });
  }
}
