import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createMeetingSchema, deleteMeetingScopeSchema, respondToMeetingSchema, updateMeetingSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
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
    const requestingUser = await this.meetingsService.resolveRequestingUser(orgId, session.user.id);
    return this.meetingsService.list(orgId, requestingUser, {
      contactId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * S-09.12 (dashboard v2) — "upcoming meetings" widget. Declared before
   * `:id` below — Nest matches routes in declaration order, so a literal
   * segment must come first or it's swallowed by `:id` (id="upcoming").
   */
  @Get("upcoming")
  async upcoming(@Session() session: UserSession, @Query("withinDays") withinDays?: string) {
    const orgId = requireOrgId(session);
    return this.meetingsService.upcomingForDashboard(orgId, session.user.id, {
      withinDays: withinDays ? Number(withinDays) : undefined,
    });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const requestingUser = await this.meetingsService.resolveRequestingUser(orgId, session.user.id);
    return this.meetingsService.getOne(orgId, id, requestingUser);
  }

  /** PRD S-01.10 — same visibility gate as getOne; an attendee list is meeting detail. */
  @Get(":id/attendees")
  async attendees(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    const requestingUser = await this.meetingsService.resolveRequestingUser(orgId, session.user.id);
    return this.meetingsService.listAttendees(orgId, id, requestingUser);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("meetings.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createMeetingSchema.parse(body);
    return this.meetingsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("meetings.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateMeetingSchema.parse(body);
    return this.meetingsService.update(orgId, id, session.user.id, input);
  }

  /** PRD S-01.14 — `scope`/`occurrenceDate` are query params, not a DELETE body, to avoid the body-on-DELETE question entirely; `?scope=occurrence&occurrenceDate=...` deletes just that occurrence, defaulting to the whole series when omitted. */
  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("meetings.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(
    @Session() session: UserSession,
    @Param("id") id: string,
    @Query("scope") scope?: string,
    @Query("occurrenceDate") occurrenceDate?: string,
  ) {
    const orgId = requireOrgId(session);
    const parsed = deleteMeetingScopeSchema.parse({ scope, occurrenceDate });
    return this.meetingsService.delete(orgId, id, session.user.id, parsed);
  }

  /** PRD S-01.12 — self-service; no @RequireCapability, any org member with an invite can respond to it. */
  @Post(":id/respond")
  @OrgRoles(["owner", "staff", "field"])
  @UseInterceptors(IdempotencyInterceptor)
  async respond(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = respondToMeetingSchema.parse(body);
    return this.meetingsService.respond(orgId, id, session.user.id, input);
  }
}
