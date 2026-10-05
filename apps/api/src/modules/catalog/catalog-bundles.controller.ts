import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createCatalogBundleSchema, updateCatalogBundleSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { CatalogBundlesService } from "./catalog-bundles.service";

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? "Check the bundle and try again.");
  return result.data;
}

/**
 * US-QUO-25 — catalogue bundles. Reads are open to every member (the line
 * picker needs them); changes follow the catalogue's rules, same as
 * `/catalog-items`: create needs `catalog.edit_own`, the rest are checked
 * against the bundle's creator in the service.
 */
@Controller("catalog-bundles")
export class CatalogBundlesController {
  constructor(private readonly bundles: CatalogBundlesService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("includeArchived") includeArchived?: string, @Query("currency") currency?: string) {
    return this.bundles.list(requireOrgId(session), { includeArchived: includeArchived === "true", currency: currency || undefined });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    return this.bundles.getOne(requireOrgId(session), id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("catalog.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.bundles.create(requireOrgId(session), session.user.id, parse(createCatalogBundleSchema, body));
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    return this.bundles.update(requireOrgId(session), id, session.user.id, parse(updateCatalogBundleSchema, body));
  }

  @Post(":id/archive")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    return this.bundles.setArchived(requireOrgId(session), id, session.user.id, true);
  }

  @Post(":id/restore")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    return this.bundles.setArchived(requireOrgId(session), id, session.user.id, false);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    return this.bundles.delete(requireOrgId(session), id, session.user.id);
  }
}
