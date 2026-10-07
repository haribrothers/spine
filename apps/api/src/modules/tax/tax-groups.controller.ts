import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createTaxGroupSchema, updateTaxGroupSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import type { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { requireOrgId } from "../org/settings.controller";
import { TaxGroupsService } from "./tax-groups.service";

/** Same Owner-only-mutation / any-member-can-read split as tax-rates.controller.ts — see its comment. */
@Controller("tax-groups")
export class TaxGroupsController {
  constructor(private readonly taxGroupsService: TaxGroupsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("includeArchived") includeArchived?: string) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.list(orgId, { includeArchived: includeArchived === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body(new ZodValidationPipe(createTaxGroupSchema)) input: z.infer<typeof createTaxGroupSchema>) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body(new ZodValidationPipe(updateTaxGroupSchema)) input: z.infer<typeof updateTaxGroupSchema>) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.archive(orgId, id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.restore(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.taxGroupsService.delete(orgId, id, session.user.id);
  }
}
