import { Body, Controller, Delete, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createVendorPaymentSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorPaymentsService } from "./vendor-payments.service";

/**
 * Same Owner ✅ / Staff ✅ / Field ❌ posture as PaymentsController.
 * Own/others split (PRD §9): `purchases.manage` is replaced by
 * `vendor_payments.edit_own`/`edit_others`/`delete_own`/`delete_others` —
 * `edit_own` gates create (there is no update route for vendor payments at
 * all); delete is checked in `VendorPaymentsService` via
 * `requireOwnershipCapability`.
 */
@Controller("vendor-payments")
@OrgRoles(["owner", "staff"])
export class VendorPaymentsController {
  constructor(private readonly vendorPaymentsService: VendorPaymentsService) {}

  /** `billId` dispatches to `listForBill` (a real join through vendor_payment_allocations) — mirrors PaymentsController's own `invoiceId` dispatch exactly. */
  @Get()
  async list(@Session() session: UserSession, @Query("contactId") contactId?: string, @Query("billId") billId?: string) {
    const orgId = requireOrgId(session);
    if (billId) {
      return this.vendorPaymentsService.listForBill(orgId, billId);
    }
    return this.vendorPaymentsService.list(orgId, { contactId });
  }

  @Get("suggest-allocation")
  async suggestAllocation(@Session() session: UserSession, @Query("contactId") contactId: string, @Query("amount") amount: string) {
    const orgId = requireOrgId(session);
    return this.vendorPaymentsService.suggestAllocation(orgId, contactId, BigInt(amount));
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorPaymentsService.getOne(orgId, id);
  }

  /** `GET /vendor-payments/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "vendor_payment"`), same pattern as InvoicesController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorPaymentsService.getHistory(orgId, id);
  }

  @Post()
  @RequireCapability("vendor_payments.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createVendorPaymentSchema.parse(body);
    return this.vendorPaymentsService.create(orgId, session.user.id, input);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorPaymentsService.delete(orgId, id, session.user.id);
  }
}
