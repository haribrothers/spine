import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createInvoiceSchema, updateInvoiceSchema, voidInvoiceSchema } from "@spine/shared";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { InvoicesService } from "./invoices.service";
import { IssuedPdfService } from "../pdf/issued-pdf.service";

/**
 * PRD §2.1/§9 — Invoices use the own/others capability split:
 * `invoices.edit_own`/`edit_others` gate create/update (already
 * draft-only; an issued invoice can never be edited by anyone),
 * `invoices.delete_own`/`delete_others` gate delete (already draft-only).
 * Issue/void/send/send-reminder are one-way workflow actions, not edits,
 * so they get their own dedicated capabilities — `invoices.issue`,
 * `invoices.void`, `invoices.send`, `invoices.send_reminder` — independent
 * of the edit/delete pair, same pattern as Quotes'
 * `quotes.send`/`quotes.revise`. Ownership checks that depend on the
 * loaded record (`update`, `delete`) are enforced in the service layer via
 * `requireOwnershipCapability`, not `@RequireCapability` here. No view
 * access at all for Field — every route carries
 * `@OrgRoles(["owner", "staff"])`.
 */
@Controller("invoices")
@OrgRoles(["owner", "staff"])
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly issuedPdf: IssuedPdfService,
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

  /** `GET /invoices/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "invoice"`), same pattern as ContactsController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.getHistory(orgId, id);
  }

  /** US-INV-17 — live for a draft; the PDF stored at issue for an issued invoice, same as QuotesController.getPdf. */
  @Get(":id/pdf")
  async getPdf(@Session() session: UserSession, @Param("id") id: string, @Res() res: Response) {
    const orgId = requireOrgId(session);
    const { buffer, filename } = await this.issuedPdf.forDownload(orgId, "invoice", id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
  @RequireCapability("invoices.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createInvoiceSchema.parse(body);
    return this.invoicesService.create(orgId, session.user.id, input);
  }

  /**
   * S-03.10's invoice half — creates a draft invoice from an accepted
   * quote's own snapshot. See InvoicesService.convertFromQuote's own doc
   * comment. `confirm` (optional, defaults false) is only meaningful when
   * the org's `quote_conversion_guard` setting is "warn": passing it lets
   * the caller proceed after being shown a 409's warning body once
   * (QuoteConversionGuardService.check), for a quote that's already been
   * converted before.
   */
  @Post("from-quote/:quoteId")
  @RequireCapability("invoices.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async convertFromQuote(@Session() session: UserSession, @Param("quoteId") quoteId: string, @Body("confirm") confirm?: boolean) {
    const orgId = requireOrgId(session);
    return this.invoicesService.convertFromQuote(orgId, session.user.id, quoteId, confirm === true);
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
  @RequireCapability("invoices.issue")
  @UseInterceptors(IdempotencyInterceptor)
  async issue(@Session() session: UserSession, @Param("id") id: string, @Body() body: { revenueAccountId?: string } = {}) {
    const orgId = requireOrgId(session);
    return this.invoicesService.issue(orgId, id, session.user.id, body?.revenueAccountId);
  }

  /** S-05.7 — queues emailing the invoice PDF to its contact. Deliberately separate from `issue` — see InvoicesService.sendEmail's own doc comment. */
  @Post(":id/send-email")
  @RequireCapability("invoices.send")
  @UseInterceptors(IdempotencyInterceptor)
  async sendEmail(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.sendEmail(orgId, id, session.user.id);
  }

  /** S-05.10 — one-click payment reminder for an overdue invoice; reuses sendEmail's own queue/worker with reminder-flavored copy, see InvoicesService.sendReminder's own doc comment. */
  @Post(":id/send-reminder")
  @RequireCapability("invoices.send_reminder")
  @UseInterceptors(IdempotencyInterceptor)
  async sendReminder(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.invoicesService.sendReminder(orgId, id, session.user.id);
  }

  /** S-05.8 — void with a required reason; posts a reversing journal entry. */
  @Post(":id/void")
  @RequireCapability("invoices.void")
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
