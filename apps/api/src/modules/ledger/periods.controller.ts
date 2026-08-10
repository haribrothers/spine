import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { createFiscalPeriodSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { requireOrgId } from "../org/settings.controller";
import { PeriodsService } from "./periods.service";

/** S-09.8 — Owner-only, matching "As an owner, I want to close a period" literally; no Team-configurable capability, same category as tax rules/org settings management per CLAUDE.md's permission model. */
@Controller("org/fiscal-periods")
@OrgRoles(["owner"])
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.periodsService.list(orgId);
  }

  @Post()
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createFiscalPeriodSchema.parse(body);
    return this.periodsService.create(orgId, input);
  }

  @Post(":id/close")
  async close(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.periodsService.close(orgId, id);
  }

  @Post(":id/reopen")
  async reopen(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.periodsService.reopen(orgId, id);
  }
}
