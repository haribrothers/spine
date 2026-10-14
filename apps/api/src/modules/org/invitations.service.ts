import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { isEmailAddress, type InviteMembersResult, type InviteSkipReason, type MemberTeamRef } from "@spine/shared";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { auth } from "../../auth/auth";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invitation, invitationTeams, member, teams, user } from "../../db/schema";
import { appUrl } from "../email/email-layout";

/** US-TEAM-21 — a pending invite as the Invites tab shows it. */
export interface InvitationListRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviterId: string;
  inviterName: string | null;
  organizationId: string;
  teams: MemberTeamRef[];
  acceptUrl: string;
}

/**
 * US-TEAM-21 (D-232) — inviting several people at once, onto their Teams.
 * Each invite still goes through Better Auth's own `createInvitation`
 * (its checks, its expiry, its email); this decides who to skip first,
 * so one bad address never stops the rest, and records the Teams the
 * invite joins on acceptance (`invitation_teams`).
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async inviteMany(orgId: string, headers: Headers, emails: string[], role: "staff" | "field", teamIds: string[] | undefined): Promise<InviteMembersResult> {
    const teamsToJoin = role === "staff" ? await this.requireTeams(orgId, teamIds ?? (await this.defaultTeamIds(orgId))) : [];
    const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const valid = wanted.filter(isEmailAddress);

    const members = valid.length
      ? new Set(
          (
            await this.db
              .select({ email: user.email })
              .from(member)
              .innerJoin(user, eq(user.id, member.userId))
              .where(and(eq(member.organizationId, orgId), inArray(sql`lower(${user.email})`, valid)))
          ).map((r) => r.email.toLowerCase()),
        )
      : new Set<string>();
    const pending = valid.length
      ? new Set(
          (
            await this.db
              .select({ email: invitation.email })
              .from(invitation)
              .where(and(eq(invitation.organizationId, orgId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date()), inArray(sql`lower(${invitation.email})`, valid)))
          ).map((r) => r.email.toLowerCase()),
        )
      : new Set<string>();

    const result: InviteMembersResult = { invited: [], skipped: [] };
    const skip = (email: string, reason: InviteSkipReason) => result.skipped.push({ email, reason });
    for (const email of wanted) {
      if (!isEmailAddress(email)) skip(email, "not an email address");
      else if (members.has(email)) skip(email, "already a member");
      else if (pending.has(email)) skip(email, "already invited — resend it instead");
      else {
        try {
          // An expired invite to the same address is refreshed rather than refused.
          const created = await auth.api.createInvitation({ body: { email, role, organizationId: orgId, resend: true }, headers });
          // A refreshed invite takes this request's Teams, not the earlier ones.
          await this.db.delete(invitationTeams).where(eq(invitationTeams.invitationId, created.id));
          if (teamsToJoin.length > 0) await this.db.insert(invitationTeams).values(teamsToJoin.map((t) => ({ invitationId: created.id, teamId: t.id })));
          result.invited.push({ id: created.id, email });
        } catch (err) {
          this.logger.warn(`Invite to ${email} failed: ${err instanceof Error ? err.message : String(err)}`);
          skip(email, "couldn't be invited");
        }
      }
    }
    return result;
  }

  /** Pending invites with who sent them, the Teams they join and their link. */
  async listPending(orgId: string): Promise<InvitationListRow[]> {
    const rows = await this.db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        inviterId: invitation.inviterId,
        inviterName: user.name,
        organizationId: invitation.organizationId,
      })
      .from(invitation)
      .leftJoin(user, eq(user.id, invitation.inviterId))
      .where(and(eq(invitation.organizationId, orgId), eq(invitation.status, "pending")))
      .orderBy(desc(invitation.createdAt));
    if (rows.length === 0) return [];
    const teamRows = await this.db
      .select({ invitationId: invitationTeams.invitationId, id: teams.id, name: teams.name })
      .from(invitationTeams)
      .innerJoin(teams, eq(teams.id, invitationTeams.teamId))
      .where(and(eq(teams.orgId, orgId), inArray(invitationTeams.invitationId, rows.map((r) => r.id))))
      .orderBy(desc(teams.isDefault), teams.createdAt);
    const byInvitation = new Map<string, MemberTeamRef[]>();
    for (const row of teamRows) byInvitation.set(row.invitationId, [...(byInvitation.get(row.invitationId) ?? []), { id: row.id, name: row.name }]);
    return rows.map((r) => ({ ...r, role: r.role ?? "staff", teams: byInvitation.get(r.id) ?? [], acceptUrl: appUrl(`/accept-invite/${r.id}`) }));
  }

  private async requireTeams(orgId: string, teamIds: string[]): Promise<MemberTeamRef[]> {
    const unique = [...new Set(teamIds)];
    if (unique.length === 0) return [];
    const rows = await this.db.select({ id: teams.id, name: teams.name }).from(teams).where(and(eq(teams.orgId, orgId), inArray(teams.id, unique)));
    if (rows.length !== unique.length) throw new BadRequestException("One or more Teams weren't found. Refresh and try again.");
    return rows;
  }

  private async defaultTeamIds(orgId: string): Promise<string[]> {
    const rows = await this.db.select({ id: teams.id }).from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true)));
    return rows.map((r) => r.id);
  }
}
