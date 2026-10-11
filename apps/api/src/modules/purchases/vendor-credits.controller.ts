import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { applyVendorCreditSchema, bulkVendorCreditIdsSchema, createVendorCreditSchema, createVendorRefundSchema, updateVendorCreditSchema, voidVendorCreditSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorCreditsService } from "./vendor-credits.service";

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the vendor credit and try again.");
  return parsed.data;
}

/**
 * US-PUR-24/28 — vendor credits, shaped like VendorBillsController: reads
 * for Owners and Staff, own/others edit and delete checked in the service,
 * `vendor_credits.record` for the posting step. Field never.
 */
@Controller("vendor-credits")
@OrgRoles(["owner", "staff"])
export class VendorCreditsController {
  constructor(private readonly credits: VendorCreditsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    return this.credits.list(requireOrgId(session), { status, contactId });
  }

  /** US-PUR-39 — the vendor's credits with this credit note number (not void), ignoring case and spaces. */
  @Get("possible-duplicates")
  async possibleDuplicates(@Session() session: UserSession, @Query("contactId") contactId?: string, @Query("vendorReference") vendorReference?: string, @Query("excludeId") excludeId?: string) {
    const orgId = requireOrgId(session);
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!contactId || !uuid.test(contactId) || !vendorReference) return [];
    return this.credits.possibleDuplicates(orgId, { contactId, vendorReference, excludeId: excludeId && uuid.test(excludeId) ? excludeId : undefined });
  }

  /** US-PUR-41 — record several drafts, each in its own transaction. */
  @Post("bulk/record")
  @RequireCapability("vendor_credits.record")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkRecord(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const parsed = bulkVendorCreditIdsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select the credits to record.");
    return this.credits.bulkRecord(orgId, parsed.data.ids, session.user.id);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.getOne(requireOrgId(session), id);
  }

  /** US-PUR-37 — the credit's Activity. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.activity(requireOrgId(session), id);
  }

  @Get(":id/history")
  async history(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.getHistory(requireOrgId(session), id);
  }

  @Post()
  @RequireCapability("vendor_credits.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.credits.create(requireOrgId(session), session.user.id, parse(createVendorCreditSchema, body));
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.credits.update(requireOrgId(session), id, session.user.id, parse(updateVendorCreditSchema, body));
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.delete(requireOrgId(session), id, session.user.id);
  }

  @Post(":id/record")
  @RequireCapability("vendor_credits.record")
  @UseInterceptors(IdempotencyInterceptor)
  async record(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.record(requireOrgId(session), id, session.user.id);
  }

  /** US-PUR-25 — apply to the vendor's bills (nothing posts, P24a). */
  @Post(":id/apply")
  @RequireCapability("vendor_credits.apply")
  @UseInterceptors(IdempotencyInterceptor)
  async apply(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.credits.apply(requireOrgId(session), session.user.id, id, parse(applyVendorCreditSchema, body).allocations);
  }

  @Delete(":id/allocations/:allocationId")
  @RequireCapability("vendor_credits.apply")
  @UseInterceptors(IdempotencyInterceptor)
  async removeAllocation(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Param("allocationId", ParseUUIDPipe) allocationId: string) {
    return this.credits.removeAllocation(requireOrgId(session), session.user.id, id, allocationId);
  }

  /** US-PUR-27 — void with a reason (P24 reversed); only with nothing applied or refunded. */
  @Post(":id/void")
  @RequireCapability("vendor_credits.void")
  @UseInterceptors(IdempotencyInterceptor)
  async void(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.credits.void(requireOrgId(session), session.user.id, id, parse(voidVendorCreditSchema, body).reason);
  }

  /** US-PUR-26 — record money the vendor paid back (P25). */
  @Post(":id/refunds")
  @RequireCapability("vendor_credits.apply")
  @UseInterceptors(IdempotencyInterceptor)
  async recordRefund(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.credits.recordRefund(requireOrgId(session), session.user.id, id, parse(createVendorRefundSchema, body));
  }
}

/** US-PUR-26 — `DELETE /vendor-refunds/:id` reverses a vendor refund. */
@Controller("vendor-refunds")
@OrgRoles(["owner", "staff"])
export class VendorRefundsController {
  constructor(private readonly credits: VendorCreditsService) {}

  @Delete(":id")
  @RequireCapability("vendor_credits.apply")
  @UseInterceptors(IdempotencyInterceptor)
  async remove(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.deleteRefund(requireOrgId(session), session.user.id, id);
  }
}
