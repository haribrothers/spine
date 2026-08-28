import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createLeadSchema, updateLeadSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { LeadsService, type LeadStage } from "./leads.service";

@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("stage") stage?: LeadStage) {
    const orgId = requireOrgId(session);
    return this.leadsService.list(orgId, stage);
  }

  /** S-09.11 (dashboard v2) — "pipeline by stage" chart. Declared before `:id` — see JobsController.milestonesDue's own comment on why route order matters here. */
  @Get("summary-by-stage")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("leads.manage")
  async summaryByStage(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.leadsService.summaryByStage(orgId);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("leads.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createLeadSchema.parse(body);
    return this.leadsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("leads.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateLeadSchema.parse(body);
    return this.leadsService.update(orgId, id, session.user.id, input);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("leads.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.leadsService.delete(orgId, id, session.user.id);
  }
}
