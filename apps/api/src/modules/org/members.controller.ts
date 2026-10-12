import { Body, Controller, Get, Inject, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { changeMemberRoleSchema, setMemberTeamsSchema, transferPrimaryOwnerSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { z } from "zod";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { getEffectiveCapabilities } from "../../auth/capability.util";
import { TeamsService } from "../teams/teams.service";
import { MembersService } from "./members.service";
import { requireOrgId } from "./settings.controller";

/**
 * Settings' team screen (S-10.2 list, S-10.3 deactivate). Listing is
 * available to any authenticated org member (viewing the team roster isn't
 * sensitive); deactivate/reactivate is owner-only per the PRD's "As an
 * owner" phrasing and per CLAUDE.md's server-side-authorization rule —
 * never trust a client-supplied role.
 */
@Controller("org/members")
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly teamsService: TeamsService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** US-TEAM-19 (D-232) — Owners also get each person's Teams, last active and demo flag; everyone else the rows as before. */
  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    if (await this.membersService.isOwner(orgId, session.user.id)) return this.membersService.listDetailed(orgId);
    return this.membersService.list(orgId);
  }

  /**
   * The caller's own role/isPrimaryOwner in the active org. Must come
   * before `:id/teams` below — otherwise Nest would match "me" as `:id`.
   */
  @Get("me")
  async getMe(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.membersService.getMe(orgId, session.user.id);
  }

  /**
   * The caller's own effective capability set (union across their Teams,
   * or the fixed Owner/Field resolution — see `getEffectiveCapabilities`'s
   * own doc comment). Backs the web app's privilege-aware UI — hiding a
   * button the caller can't use, purely for UX; every mutating endpoint
   * independently re-checks server-side regardless of what this returns.
   * Declared before `:id/teams` for the same route-matching reason as
   * `me` above.
   */
  @Get("me/capabilities")
  async getMyCapabilities(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return getEffectiveCapabilities(this.db, { orgId, userId: session.user.id });
  }

  @Get(":id/teams")
  @OrgRoles(["owner"])
  async getTeams(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.teamsService.getMemberTeams(orgId, id);
  }

  /** US-TEAM-20 — the Teams a Staff member is on, replaced as a whole. */
  @Put(":id/teams")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async setTeams(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setMemberTeamsSchema)) body: z.infer<typeof setMemberTeamsSchema>,
  ) {
    const orgId = requireOrgId(session);
    return this.membersService.setTeams(orgId, id, body.teamIds, session.user.id);
  }

  /** US-TEAM-20 — what they can open: role, Teams and their effective capabilities. */
  @Get(":id/access")
  @OrgRoles(["owner"])
  async access(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.access(orgId, id);
  }

  /** US-TEAM-22 — Staff ↔ Field only. */
  @Put(":id/role")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async changeRole(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changeMemberRoleSchema)) body: z.infer<typeof changeMemberRoleSchema>,
  ) {
    const orgId = requireOrgId(session);
    return this.membersService.changeRole(orgId, id, body.role, body.teamIds, session.user.id);
  }

  @Put(":id/deactivate")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async deactivate(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.setActive(orgId, id, false, session.user.id);
  }

  @Put(":id/reactivate")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async reactivate(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.setActive(orgId, id, true, session.user.id);
  }

  @Put(":id/promote")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async promote(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.promote(orgId, id, session.user.id);
  }

  @Put(":id/demote")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async demote(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.demote(orgId, id, session.user.id);
  }

  @Post("transfer-primary-owner")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async transferPrimaryOwner(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(transferPrimaryOwnerSchema)) body: z.infer<typeof transferPrimaryOwnerSchema>,
  ) {
    const orgId = requireOrgId(session);
    await this.membersService.transferPrimaryOwner(orgId, session.user.id, body.newPrimaryOwnerMemberId);
    return { transferred: true };
  }
}
