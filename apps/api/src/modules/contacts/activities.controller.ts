import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createActivitySchema, updateActivitySchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ActivitiesService } from "./activities.service";

/**
 * Own/others ownership-aware capability split (PRD §9 S-01.16), same
 * pattern as Contacts/Catalogue/Leads — see contacts.controller.ts's own
 * header comment for the full rationale on why update/markDone/markUndone/
 * delete carry no `@RequireCapability` here and instead defer to
 * `ActivitiesService`'s `requireOwnershipCapability` call. `GET` routes
 * carry no capability gate at all — read is unconditional for every
 * Staff/Field user.
 */
@Controller("activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("contactId") contactId?: string, @Query("leadId") leadId?: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.list(orgId, { contactId, leadId });
  }

  /**
   * S-01.7 — "a list of overdue follow-ups on my dashboard." Must be
   * registered before `:id` so "overdue" isn't swallowed as a path param.
   */
  @Get("overdue")
  async overdue(@Session() session: UserSession, @Query("includeToday") includeToday?: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.overdueForUser(orgId, session.user.id, { includeToday: includeToday === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("activities.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createActivitySchema.parse(body);
    return this.activitiesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateActivitySchema.parse(body);
    return this.activitiesService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/done")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async markDone(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.markDone(orgId, id, session.user.id);
  }

  @Post(":id/undone")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async markUndone(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.markUndone(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.activitiesService.delete(orgId, id, session.user.id);
  }
}
