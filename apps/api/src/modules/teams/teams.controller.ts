import { Body, Controller, Delete, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import {
  assignTeamMembersSchema,
  createTeamSchema,
  setTeamPrivilegesSchema,
  updateTeamSchema,
  type Capability,
} from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { z } from "zod";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { TeamsService } from "./teams.service";

/**
 * Team CRUD + privilege matrix + member assignment (PRD §2.1/S-10.13-14).
 * Hard-coded Owner-only everywhere — Team configuration is never itself
 * Team-configurable, per §2.1's explicit carve-out.
 */
@Controller("org/teams")
@OrgRoles(["owner"])
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.teamsService.list(orgId);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body(new ZodValidationPipe(createTeamSchema)) body: { name: string }) {
    const orgId = requireOrgId(session);
    return this.teamsService.create(orgId, body.name);
  }

  @Get(":id")
  async getDetail(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.teamsService.getDetail(orgId, id);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async rename(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTeamSchema)) body: { name?: string },
  ) {
    const orgId = requireOrgId(session);
    if (body.name) {
      return this.teamsService.rename(orgId, id, body.name);
    }
    return this.teamsService.getDetail(orgId, id);
  }

  @Delete(":id")
  async remove(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    await this.teamsService.delete(orgId, id);
    return { deleted: true };
  }

  @Put(":id/privileges")
  @UseInterceptors(IdempotencyInterceptor)
  async setPrivileges(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setTeamPrivilegesSchema)) body: z.infer<typeof setTeamPrivilegesSchema>,
  ) {
    const orgId = requireOrgId(session);
    return this.teamsService.setPrivileges(orgId, id, body.privileges as { capability: Capability; granted: boolean }[]);
  }

  @Put(":id/members")
  @UseInterceptors(IdempotencyInterceptor)
  async setMembers(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignTeamMembersSchema)) body: { memberIds: string[] },
  ) {
    const orgId = requireOrgId(session);
    await this.teamsService.setMembers(orgId, id, body.memberIds);
    return { updated: true };
  }
}
