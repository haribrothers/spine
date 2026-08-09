import { Body, Controller, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { transferPrimaryOwnerSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { z } from "zod";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
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
  ) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.membersService.list(orgId);
  }

  @Get(":id/teams")
  @OrgRoles(["owner"])
  async getTeams(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.teamsService.getMemberTeams(orgId, id);
  }

  @Put(":id/deactivate")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async deactivate(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.setActive(orgId, id, false);
  }

  @Put(":id/reactivate")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async reactivate(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.setActive(orgId, id, true);
  }

  @Put(":id/promote")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async promote(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.promote(orgId, id);
  }

  @Put(":id/demote")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async demote(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.membersService.demote(orgId, id);
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
