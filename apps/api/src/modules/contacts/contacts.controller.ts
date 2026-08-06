import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createContactSchema, updateContactSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ContactsService } from "./contacts.service";

/**
 * Per §2.1's permission table ("Manage contacts & catalogue: Owner ✅,
 * Staff ✅, Field View"), GET routes carry no `@OrgRoles` restriction — any
 * authenticated org member (owner, staff, or field) can read. Every
 * mutating route requires `@OrgRoles(["owner", "staff"])`, which also
 * blocks field server-side regardless of what the client sends.
 */
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * `type` accepts repeated query params (`?type=customer&type=vendor`),
   * matching Express's default query parser — a single value still arrives
   * as a plain string, so it's normalized to an array here. NestJS/Express
   * don't need special config for this shape (no `?types=a,b` CSV parsing
   * needed), keeping this consistent with how every other array-ish query
   * param in an Express app is conventionally handled.
   */
  @Get()
  async list(
    @Session() session: UserSession,
    @Query("type") type?: string | string[],
    @Query("search") search?: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    const orgId = requireOrgId(session);
    const types = type === undefined ? undefined : (Array.isArray(type) ? type : [type]) as ("customer" | "vendor" | "both")[];
    return this.contactsService.list(orgId, { types, search, includeArchived: includeArchived === "true" });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createContactSchema.parse(body);
    return this.contactsService.create(orgId, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateContactSchema.parse(body);
    return this.contactsService.update(orgId, id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.archive(orgId, id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.restore(orgId, id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.delete(orgId, id);
  }
}
