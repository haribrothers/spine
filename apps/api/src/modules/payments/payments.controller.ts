import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { applyPaymentCreditSchema, createPaymentSchema } from "@spine/shared";
import type { Response } from "express";
import { z } from "zod";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { PaymentsService } from "./payments.service";
import { PaymentPdfService } from "../pdf/payment-pdf.service";

/** Per §2.1, "Create invoices, record payments" is Owner ✅ / Staff ✅ / Field ❌ — same shape as InvoicesController. */
@Controller("payments")
@OrgRoles(["owner", "staff"])
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentPdfService: PaymentPdfService,
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

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.getOne(orgId, id);
  }

  /** S-06.6 — live-rendered branded receipt PDF, same convention as InvoicesController.getPdf. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.paymentPdfService.render(orgId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  /** S-06.6 — re-sends the receipt PDF to the paying contact on demand (create() already sends a plain-text confirmation; this attaches the actual PDF). */
  @Post(":id/send-receipt")
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async sendReceipt(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.sendReceiptEmail(orgId, id);
  }

  /** S-06.1/S-06.2/S-06.4/S-06.5 — records a payment, optionally allocating it across invoices in the same call. Optional `bankAccountId` in the body lets the caller pick which cash/bank account received the funds; omitted defaults to "Bank Account". */
  @Post()
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const { bankAccountId, ...rest } = (body ?? {}) as { bankAccountId?: string };
    const input = createPaymentSchema.parse(rest);
    return this.paymentsService.create(orgId, session.user.id, input, bankAccountId);
  }

  /** S-05.5 — applies an existing payment's sitting unallocated credit against one or more invoices not available (or not chosen) when the payment was originally recorded. */
  @Post(":id/apply-credit")
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async applyCredit(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = applyPaymentCreditSchema.parse(body);
    return this.paymentsService.applyCredit(orgId, session.user.id, id, input);
  }

  /** Only an unallocated payment is ever deletable — see PaymentsService.delete's own comment. */
  @Delete(":id")
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.delete(orgId, id, session.user.id);
  }
}
