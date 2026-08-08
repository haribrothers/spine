import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createMeetingSchema, updateMeetingSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { MeetingsService } from "./meetings.service";

@Controller("meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /** `from`/`to` (ISO date strings) scope the query to a visible calendar range — the /meetings page's Day/Week/Month/Agenda views each pass their own current range. */
  @Get()
  async list(
    @Session() session: UserSession,
    @Query("contactId") contactId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const orgId = requireOrgId(session);
    return this.meetingsService.list(orgId, {
      contactId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.meetingsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createMeetingSchema.parse(body);
    return this.meetingsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateMeetingSchema.parse(body);
    return this.meetingsService.update(orgId, id, session.user.id, input);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.meetingsService.delete(orgId, id, session.user.id);
  }
}
