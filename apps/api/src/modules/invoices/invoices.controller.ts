import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createInvoiceSchema, updateInvoiceSchema, voidInvoiceSchema } from "@spine/shared";
import type { Response } from "express";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { InvoicesService } from "./invoices.service";
import { InvoicePdfService } from "../pdf/invoice-pdf.service";

/**
 * Per §2.1's permission table, "Create invoices, record payments" is
 * Owner ✅ / Staff ✅ / Field ❌ — no view access at all for Field, same
 * shape as QuotesController. Every route here carries
 * `@OrgRoles(["owner", "staff"])`; issue/void further restrict per their
 * own S-05.3/S-05.8 wording (both stay owner+staff — voiding a mistake is
 * explicitly staff-doable too, unlike quotes' discount-approval which is
 * owner-only per S-03.9).
 */
@Controller("invoices")
@OrgRoles(["owner", "staff"])
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.list(orgId, { status, contactId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.getOne(orgId, id);
  }

  /** Live-rendered branded PDF, same convention as QuotesController.getPdf. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.invoicePdfService.render(orgId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createInvoiceSchema.parse(body);
    return this.invoicesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateInvoiceSchema.parse(body);
    return this.invoicesService.update(orgId, id, session.user.id, input);
  }

  /** S-05.3 — allocates the gapless number, flips to issued, posts the "Invoice issued" journal entry (§7.2). Optional `revenueAccountId` in the body lets the caller pick an income account; omitted defaults to "Sales — Services". */
  @Post(":id/issue")
  @UseInterceptors(IdempotencyInterceptor)
  async issue(@Session() session: UserSession, @Param("id") id: string, @Body() body: { revenueAccountId?: string } = {}) {
    const orgId = requireOrgId(session);
    return this.invoicesService.issue(orgId, id, session.user.id, body?.revenueAccountId);
  }

  /** S-05.8 — void with a required reason; posts a reversing journal entry. */
  @Post(":id/void")
  @UseInterceptors(IdempotencyInterceptor)
  async void(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = voidInvoiceSchema.parse(body);
    return this.invoicesService.void(orgId, id, session.user.id, input.reason);
  }

  /** Only a draft is ever hard-deletable — see InvoicesService.delete's own comment. */
  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.delete(orgId, id, session.user.id);
  }
}
