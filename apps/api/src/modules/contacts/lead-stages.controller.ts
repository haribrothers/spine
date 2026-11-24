import { BadRequestException, Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { putLeadStagesSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { LeadStagesService } from "./lead-stages.service";

/**
 * US-CRM-19 / US-CRM-20 — pipeline stages. Every member reads them (the
 * board and lead forms need them); only an Owner changes them, as with the
 * rest of organisation Settings.
 */
@Controller("org/lead-stages")
export class LeadStagesController {
  constructor(private readonly leadStages: LeadStagesService) {}

  @Get()
  async list(@Session() session: UserSession) {
    return this.leadStages.list(requireOrgId(session));
  }

  @Put()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async replace(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = putLeadStagesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the stages and try again.");
    return this.leadStages.replace(requireOrgId(session), session.user.id, parsed.data);
  }
}
