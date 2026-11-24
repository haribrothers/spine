import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createVendorPaymentSchema, sendRemittanceSchema } from "@spine/shared";
import { RequireCapability, RequireSectionOpen } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorPaymentsService } from "./vendor-payments.service";
import { VendorRemittanceService } from "./vendor-remittance.service";

/**
 * Same Owner ✅ / Staff ✅ / Field ❌ posture as PaymentsController.
 * Own/others split (PRD §9): `purchases.manage` is replaced by
 * `vendor_payments.edit_own`/`edit_others`/`delete_own`/`delete_others` —
 * `edit_own` gates create (there is no update route for vendor payments at
 * all); delete is checked in `VendorPaymentsService` via
 * `requireOwnershipCapability`.
 */
@Controller("vendor-payments")
@RequireSectionOpen("vendor_payments.open")
@OrgRoles(["owner", "staff"])
export class VendorPaymentsController {
  constructor(
    private readonly vendorPaymentsService: VendorPaymentsService,
    private readonly remittance: VendorRemittanceService,
  ) {}

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

  /** US-PUR-51 — the list's cards. */
  @Get("summary")
  async summary(@Session() session: UserSession) {
    return this.vendorPaymentsService.summary(requireOrgId(session));
  }

  /** US-PUR-53 — the same vendor and amount within 3 days, or the same reference. */
  @Get("possible-duplicates")
  async possibleDuplicates(@Session() session: UserSession, @Query() query: Record<string, string | undefined>) {
    const parsed = z
      .object({ contactId: z.string().uuid(), amount: z.coerce.bigint().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().optional() })
      .parse(query);
    return this.vendorPaymentsService.possibleDuplicates(requireOrgId(session), parsed);
  }

  /** US-PUR-49 — the payment's story. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id") id: string) {
    return this.vendorPaymentsService.activity(requireOrgId(session), id);
  }

  /** US-PUR-54 — the remittance advice PDF, generated when asked for. */
  @Get(":id/remittance.pdf")
  async remittancePdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const { buffer, filename } = await this.remittance.pdf(requireOrgId(session), id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
  }

  @Get(":id/remittance/draft")
  async remittanceDraft(@Session() session: UserSession, @Param("id") id: string) {
    return this.remittance.draft(requireOrgId(session), id, session.user.id, session.user.name ?? null);
  }

  @Post(":id/remittance/send")
  @UseInterceptors(IdempotencyInterceptor)
  async remittanceSend(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const parsed = sendRemittanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the email and try again.");
    return this.remittance.send(requireOrgId(session), id, session.user.id, parsed.data);
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
