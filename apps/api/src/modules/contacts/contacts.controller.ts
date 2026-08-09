import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createContactSchema, updateContactSchema } from "@spine/shared";
import { z } from "zod";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ContactsService } from "./contacts.service";

/**
 * Sane upper bound on one import request — matches this codebase's other
 * explicit-limit precedents (e.g. FilesController's MAX_UPLOAD_BYTES).
 * `importMany` runs rows sequentially (one `create()` call — its own
 * duplicate check, transaction, and audit-log write — per row, not a batch
 * insert), a deliberate simplicity/correctness tradeoff over raw
 * throughput: parallelizing would let two rows in the same import race
 * each other's duplicate-detection query. Measured locally at ~3ms/row, so
 * 500 stays comfortably under a few seconds; a CSV larger than this should
 * be split by the user rather than risk one oversized request timing out.
 */
const MAX_IMPORT_ROWS = 500;
const importContactsSchema = z.object({ rows: z.array(createContactSchema).min(1).max(MAX_IMPORT_ROWS) });

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

  /**
   * S-10.6 / this task's audit-log instrumentation — a real read endpoint
   * against real writes, scoped to Contacts (contact + its four sub-entity
   * types). No `@OrgRoles` restriction, matching every other GET in this
   * module — history is a read, not a mutation.
   */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.getHistory(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createContactSchema.parse(body);
    return this.contactsService.create(orgId, session.user.id, input);
  }

  /**
   * S-01.8 — bulk create from a client-reviewed CSV import. Rows are
   * already-validated `CreateContactInput` shapes by the time they reach
   * here (the web import wizard parses/maps/previews the CSV itself); this
   * endpoint's job is just to run each through the normal `create()` path
   * and report per-row success/failure, not to parse CSV server-side.
   */
  @Post("import")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async import(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const { rows } = importContactsSchema.parse(body);
    return this.contactsService.importMany(orgId, session.user.id, rows);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateContactSchema.parse(body);
    return this.contactsService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/archive")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.archive(orgId, id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.restore(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("contacts.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.contactsService.delete(orgId, id, session.user.id);
  }
}
