import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createLeadSchema, updateLeadSchema } from "@spine/shared";
import { RequireCapability, RequireSectionOpen } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { LeadsService } from "./leads.service";

/**
 * Own/others ownership-aware capability split (PRD §9 S-01.16), same
 * pattern as Contacts/Catalogue — see contacts.controller.ts's own header
 * comment for the full rationale on why update/delete carry no
 * `@RequireCapability` here and instead defer to `LeadsService`'s
 * `requireOwnershipCapability` call. `GET` routes (including
 * `summary-by-stage`) carry no capability gate at all — read is
 * unconditional for every Staff/Field user.
 */
@Controller("leads")
@RequireSectionOpen("leads.open")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("stageId") stageId?: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.list(orgId, stageId);
  }

  /** S-09.11 (dashboard v2) — "pipeline by stage" chart. Declared before `:id` — see JobsController.milestonesDue's own comment on why route order matters here. */
  @Get("summary-by-stage")
  async summaryByStage(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.leadsService.summaryByStage(orgId);
  }

  /** US-CRM-27 — the lead's creation and stage changes, from the audit log. Readable like the lead itself. */
  @Get(":id/history")
  async history(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.history(orgId, id);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("leads.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createLeadSchema.parse(body);
    return this.leadsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateLeadSchema.parse(body);
    return this.leadsService.update(orgId, id, session.user.id, input);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.delete(orgId, id, session.user.id);
  }
}
