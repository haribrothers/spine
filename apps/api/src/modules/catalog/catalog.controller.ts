import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createCatalogItemSchema, updateCatalogItemSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { CatalogService } from "./catalog.service";

/**
 * Per §2.1's permission table ("Manage contacts & catalogue: Owner ✅,
 * Staff ✅, Field View"), GET routes carry no `@OrgRoles` restriction — any
 * authenticated org member (owner, staff, or field) can read. Every
 * mutating route requires `@OrgRoles(["owner", "staff"])`, which also
 * blocks field server-side regardless of what the client sends. Route
 * prefix is `catalog-items` (plural resource, kebab-case), matching the
 * flat `contacts` prefix convention rather than nesting under `/catalog`.
 */
@Controller("catalog-items")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async list(
    @Session() session: UserSession,
    @Query("search") search?: string,
    @Query("category") category?: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const orgId = requireOrgId(session);
    return this.catalogService.list(orgId, { search, category, includeArchived: includeArchived === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.catalogService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createCatalogItemSchema.parse(body);
    return this.catalogService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateCatalogItemSchema.parse(body);
    return this.catalogService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.catalogService.archive(orgId, id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.catalogService.restore(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.catalogService.delete(orgId, id, session.user.id);
  }
}
