import { Controller, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
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
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.membersService.list(orgId);
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
}
