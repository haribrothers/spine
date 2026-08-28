import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createCatalogItemSchema, updateCatalogItemSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { CatalogService } from "./catalog.service";

/**
 * Per §2.1's permission table, GET routes carry no `@OrgRoles` restriction —
 * any authenticated org member (owner, staff, or field) can read,
 * unconditionally, regardless of who created a given catalogue item. Every
 * mutating route requires `@OrgRoles(["owner", "staff"])`, which also
 * blocks field server-side regardless of what the client sends. Route
 * prefix is `catalog-items` (plural resource, kebab-case), matching the
 * flat `contacts` prefix convention rather than nesting under `/catalog`.
 *
 * Own/others ownership-aware capability split (PRD §9 S-02.5), structurally
 * identical to Contacts but using its own independent `catalog.*`
 * capabilities (`catalog.edit_own`/`edit_others`/`delete_own`/
 * `delete_others`) — a Team's Contacts and Catalogue grants are configured
 * separately, not shared. See contacts.controller.ts's own header comment
 * for the full rationale on why update/archive/restore/delete carry no
 * `@RequireCapability` here and instead defer to `CatalogService`'s
 * `requireOwnershipCapability` call.
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
  @RequireCapability("catalog.edit_own")
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
