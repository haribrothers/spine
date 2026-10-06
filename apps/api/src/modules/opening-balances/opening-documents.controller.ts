import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseInterceptors } from "@nestjs/common";
import { openingCustomerCreditSchema, openingInvoiceImportSchema, openingInvoiceInputSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { OpeningInvoicesService } from "./opening-invoices.service";

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0]?.message ?? "Check the entry and try again.";

/** US-RPT-17 — opening customer invoices and customer credit. Owner-only (07-security). */
@Controller("opening-balances")
@OrgRoles(["owner"])
export class OpeningDocumentsController {
  constructor(private readonly invoices: OpeningInvoicesService) {}

  @Get("invoices")
  async listInvoices(@Session() session: UserSession) {
    return this.invoices.listInvoices(requireOrgId(session));
  }

  @Post("invoices")
  @UseInterceptors(IdempotencyInterceptor)
  async createInvoice(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = openingInvoiceInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.invoices.createInvoice(requireOrgId(session), session.user.id, parsed.data);
  }

  @Post("invoices/import")
  @UseInterceptors(IdempotencyInterceptor)
  async importInvoices(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = openingInvoiceImportSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.invoices.importInvoices(requireOrgId(session), session.user.id, parsed.data);
  }

  @Put("invoices/:id")
  @UseInterceptors(IdempotencyInterceptor)
  async updateInvoice(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = openingInvoiceInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.invoices.updateInvoice(requireOrgId(session), session.user.id, id, parsed.data);
  }

  @Delete("invoices/:id")
  @UseInterceptors(IdempotencyInterceptor)
  async deleteInvoice(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.deleteInvoice(requireOrgId(session), session.user.id, id);
  }

  @Get("customer-credits")
  async listCredits(@Session() session: UserSession) {
    return this.invoices.listCredits(requireOrgId(session));
  }

  @Post("customer-credits")
  @UseInterceptors(IdempotencyInterceptor)
  async createCredit(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = openingCustomerCreditSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.invoices.createCredit(requireOrgId(session), session.user.id, parsed.data);
  }

  @Delete("customer-credits/:id")
  @UseInterceptors(IdempotencyInterceptor)
  async deleteCredit(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.deleteCredit(requireOrgId(session), session.user.id, id);
  }
}
