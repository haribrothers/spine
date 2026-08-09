import { Body, Controller, Delete, Get, Param, Post, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createPaymentSchema } from "@spine/shared";
import { z } from "zod";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { PaymentsService } from "./payments.service";

/** Per §2.1, "Create invoices, record payments" is Owner ✅ / Staff ✅ / Field ❌ — same shape as InvoicesController. */
@Controller("payments")
@OrgRoles(["owner", "staff"])
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  /** S-06.1/S-06.2/S-06.4/S-06.5 — records a payment, optionally allocating it across invoices in the same call. Optional `bankAccountId` in the body lets the caller pick which cash/bank account received the funds; omitted defaults to "Bank Account". */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const { bankAccountId, ...rest } = (body ?? {}) as { bankAccountId?: string };
    const input = createPaymentSchema.parse(rest);
    return this.paymentsService.create(orgId, session.user.id, input, bankAccountId);
  }

  /** Only an unallocated payment is ever deletable — see PaymentsService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.paymentsService.delete(orgId, id, session.user.id);
  }
}
