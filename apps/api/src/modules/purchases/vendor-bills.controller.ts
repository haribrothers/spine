import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { BadRequestException } from "@nestjs/common";
import { bulkVendorBillIdsSchema, createVendorBillSchema, updateVendorBillSchema, voidVendorBillSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorBillsService } from "./vendor-bills.service";

/**
 * Per §2.1's permission table shape (Owner ✅ / Staff ✅ / Field ❌, same
 * posture as InvoicesController).
 *
 * Own/others split (PRD §9): `purchases.manage` is replaced by
 * `vendor_bills.edit_own`/`edit_others`/`delete_own`/`delete_others`
 * (create/update/delete, checked in `VendorBillsService` via
 * `requireOwnershipCapability`) plus dedicated `vendor_bills.record`/
 * `vendor_bills.void` for the one-way status transitions.
 */
@Controller("vendor-bills")
@OrgRoles(["owner", "staff"])
export class VendorBillsController {
  constructor(private readonly vendorBillsService: VendorBillsService) {}

  @Get()
  async list(
    @Session() session: UserSession,
    @Query("status") status?: string,
    @Query("contactId") contactId?: string,
    @Query("jobId") jobId?: string,
  ) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.list(orgId, { status, contactId, jobId });
  }

  /** US-PUR-35 — this vendor's bills with the same number (not void), before entering one twice. A read, like every GET here. */
  @Get("possible-duplicates")
  async possibleDuplicates(
    @Session() session: UserSession,
    @Query("contactId") contactId?: string,
    @Query("billNumber") billNumber?: string,
    @Query("excludeId") excludeId?: string,
  ) {
    const orgId = requireOrgId(session);
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!contactId || !uuid.test(contactId) || (excludeId && !uuid.test(excludeId))) throw new BadRequestException("Choose a vendor first.");
    return this.vendorBillsService.possibleDuplicates(orgId, { contactId, billNumber: billNumber ?? "", excludeId });
  }

  /** US-PUR-36 — record several drafts; each in its own transaction, the skipped ones named. */
  @Post("bulk/record")
  @RequireCapability("vendor_bills.record")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkRecord(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const parsed = bulkVendorBillIdsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select the bills to record.");
    return this.vendorBillsService.bulkRecord(orgId, parsed.data.ids, session.user.id);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.getOne(orgId, id);
  }

  /** `GET /vendor-bills/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "vendor_bill"`), same pattern as InvoicesController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.getHistory(orgId, id);
  }

  /** US-PUR-32 — the bill's Activity. A read, like every GET here. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id") id: string) {
    return this.vendorBillsService.activity(requireOrgId(session), id);
  }

  @Post()
  @RequireCapability("vendor_bills.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createVendorBillSchema.parse(body);
    return this.vendorBillsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateVendorBillSchema.parse(body);
    return this.vendorBillsService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/record")
  @RequireCapability("vendor_bills.record")
  @UseInterceptors(IdempotencyInterceptor)
  async record(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.record(orgId, id, session.user.id);
  }

  @Post(":id/void")
  @RequireCapability("vendor_bills.void")
  @UseInterceptors(IdempotencyInterceptor)
  async void(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = voidVendorBillSchema.parse(body);
    return this.vendorBillsService.void(orgId, id, session.user.id, input.reason);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.delete(orgId, id, session.user.id);
  }
}
