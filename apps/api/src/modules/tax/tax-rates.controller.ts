import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createTaxRateSchema, updateTaxRateSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import type { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { TaxRatesService } from "./tax-rates.service";

/**
 * PRD §2.1 — "manage ... tax rules" is hard-coded Owner-only, never
 * Team-configurable (Spine's permission model section) — every
 * *mutating* route below is `@OrgRoles(["owner"])`. GET routes are
 * deliberately NOT owner-only: Staff building a quote/invoice line (or a
 * catalog item) needs to read the list of named rates to pick from, exactly
 * as Staff can already read (but not manage) the catalogue and chart of
 * accounts.
 */
@Controller("tax-rates")
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("includeArchived") includeArchived?: string) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.list(orgId, { includeArchived: includeArchived === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body(new ZodValidationPipe(createTaxRateSchema)) input: z.infer<typeof createTaxRateSchema>) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body(new ZodValidationPipe(updateTaxRateSchema)) input: z.infer<typeof updateTaxRateSchema>) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.archive(orgId, id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.restore(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxRatesService.delete(orgId, id, session.user.id);
  }
}
