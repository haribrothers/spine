import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import { parseEmailOverride } from "../email/email-text";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { applyPaymentCreditSchema, createPaymentSchema, unapplyPaymentSchema } from "@spine/shared";
import type { Response } from "express";
import { z } from "zod";
import { RequireCapability, RequireSectionOpen } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { PaymentsService } from "./payments.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

/**
 * PRD §2.1/§9 — Payments use the own/others capability split:
 * `payments.edit_own` gates create (there's no update route at all, so
 * `payments.edit_others` is reserved with nothing to gate yet, same shape
 * as `vendor_payments.edit_others`); `payments.delete_own`/`delete_others`
 * gate delete (only possible while unallocated). `apply-credit` and
 * `send-receipt` are workflow actions, not edits, so they get their own
 * dedicated capabilities — `payments.apply_credit`, `payments.send_receipt`
 * — independent of the edit/delete pair. Ownership checks that depend on
 * the loaded record (`delete`) are enforced in the service layer via
 * `requireOwnershipCapability`, not `@RequireCapability` here. No view
 * access at all for Field — same shape as InvoicesController.
 */
@Controller("payments")
@RequireSectionOpen("payments.open")
@OrgRoles(["owner", "staff"])
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly issuedPdf: IssuedPdfService,
  ) {}

  /** `invoiceId` dispatches to `listForInvoice` (a real join through payment_allocations, not a contactId filter) — backs the invoice detail page's own "Payments" section. Mutually exclusive with `contactId` in practice, but not enforced — `invoiceId` simply takes precedence when both are given, since no caller has a reason to pass both. */
  @Get()
  async list(@Session() session: UserSession, @Query("contactId") contactId?: string, @Query("invoiceId") invoiceId?: string) {
    const orgId = requireOrgId(session);
    if (invoiceId) {
      return this.paymentsService.listForInvoice(orgId, invoiceId);
    }
    return this.paymentsService.list(orgId, { contactId });
  }

  /** S-06.3 — oldest-first allocation suggestion, computed only (no writes). Query params rather than a body since this is a read/preview action. */
  @Get("suggest-allocation")
  async suggestAllocation(@Session() session: UserSession, @Query("contactId") contactId: string, @Query("amount") amount: string) {
    const orgId = requireOrgId(session);
    const parsedAmount = z.coerce.bigint().positive().parse(amount);
    return this.paymentsService.suggestAllocation(orgId, contactId, parsedAmount);
  }

  /** US-PAY-24 — payments that look like the one about to be recorded (same customer and amount within 3 days, or the same reference). */
  @Get("possible-duplicates")
  async possibleDuplicates(@Session() session: UserSession, @Query() query: Record<string, string | undefined>) {
    const orgId = requireOrgId(session);
    const parsed = z
      .object({ contactId: z.string().uuid(), amount: z.coerce.bigint().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().optional() })
      .parse(query);
    return this.paymentsService.possibleDuplicates(orgId, parsed);
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.getOne(orgId, id);
  }

  /** `GET /payments/:id/history` — same pattern as InvoicesController.getHistory. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.getHistory(orgId, id);
  }

  /** US-PAY-20 — what happened to the payment, newest first. */
  @Get(":id/activity")
  async activity(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.paymentsService.activity(requireOrgId(session), id);
  }

  /** S-06.6 / US-INV-17 — the receipt PDF stored when the payment was recorded, same as InvoicesController.getPdf. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.issuedPdf.forDownload(orgId, "payment", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  /** S-06.6 — re-sends the receipt PDF to the paying contact on demand (create() already sends a plain-text confirmation; this attaches the actual PDF). */
  @Post(":id/send-receipt")
  @RequireCapability("payments.send_receipt")
  @UseInterceptors(IdempotencyInterceptor)
  async sendReceipt(@Session() session: UserSession, @Param("id") id: string, @Body() body?: unknown) {
    const orgId = requireOrgId(session);
    // US-SET-21: the "Send" dialog may change this one email.
    return this.paymentsService.sendReceiptEmail(orgId, id, parseEmailOverride("receipt", body));
  }

  /** S-06.1/S-06.2/S-06.4/S-06.5 — records a payment, optionally allocating it across invoices in the same call. `moneyAccountId` (US-BANK-03) picks the account the money went into; omitted means the organisation's default. */
  @Post()
  @RequireCapability("payments.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createPaymentSchema.parse(body);
    return this.paymentsService.create(orgId, session.user.id, input);
  }

  /** S-05.5 — applies an existing payment's sitting unallocated credit against one or more invoices not available (or not chosen) when the payment was originally recorded. */
  @Post(":id/apply-credit")
  @RequireCapability("payments.apply_credit")
  @UseInterceptors(IdempotencyInterceptor)
  async applyCredit(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = applyPaymentCreditSchema.parse(body);
    return this.paymentsService.applyCredit(orgId, session.user.id, id, input);
  }

  /** US-PAY-26 (D-221) — moves the payment off an invoice; the amount becomes the customer's credit (P30). */
  @Post(":id/allocations/:allocationId/unapply")
  @RequireCapability("payments.apply_credit")
  @UseInterceptors(IdempotencyInterceptor)
  async unapply(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Param("allocationId", ParseUUIDPipe) allocationId: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = unapplyPaymentSchema.parse(body ?? {});
    return this.paymentsService.unapply(orgId, session.user.id, id, allocationId, input.reason);
  }

  /** Only an unallocated payment is ever deletable — see PaymentsService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.delete(orgId, id, session.user.id);
  }
}
