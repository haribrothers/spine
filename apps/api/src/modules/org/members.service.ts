import { BadRequestException, Inject, Injectable } from "@nestjs/common";
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

  async list(orgId: string): Promise<MemberRow[]> {
    const rows = await this.db
      .select({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        isActive: member.isActive,
        deactivatedAt: member.deactivatedAt,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));

    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async setActive(orgId: string, memberId: string, isActive: boolean): Promise<MemberRow> {
    const [existing] = await this.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.id, memberId)));

    if (!existing) {
      throw new BadRequestException("Member not found");
    }
    if (existing.role === "owner" && !isActive) {
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

    const [row] = await this.db
      .select({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        isActive: member.isActive,
        deactivatedAt: member.deactivatedAt,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.id, updated!.id));

    return row!;
  }
}
