import { Body, Controller, Delete, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createVendorPaymentSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorPaymentsService } from "./vendor-payments.service";

/** Same Owner ✅ / Staff ✅ / Field ❌ posture as PaymentsController, gated on `purchases.manage`. */
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

  @Post()
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createVendorPaymentSchema.parse(body);
    return this.vendorPaymentsService.create(orgId, session.user.id, input);
  }

  @Delete(":id")
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorPaymentsService.delete(orgId, id, session.user.id);
  }
}
