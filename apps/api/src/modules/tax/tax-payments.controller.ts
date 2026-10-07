import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseInterceptors } from "@nestjs/common";
import { createTaxPaymentSchema, createTaxRefundSchema, taxPaymentListQuerySchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { orgClock } from "../../common/org-clock";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { TaxPaymentsService } from "./tax-payments.service";

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0]?.message ?? "Check the entry and try again.";

/** US-TAX-08 — tax paid to and refunded by the authority. Owner-only, never Team-configurable (07-security). */
@Controller("tax-payments")
@OrgRoles(["owner"])
export class TaxPaymentsController {
  constructor(private readonly taxPayments: TaxPaymentsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = taxPaymentListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.taxPayments.list(requireOrgId(session), parsed.data.from, parsed.data.to);
  }

  /** The input tax there is to use on a date (the dialog's "Input tax available"). */
  @Get("input-tax-available")
  async inputTaxAvailable(@Session() session: UserSession, @Query("date") date?: string) {
    const on = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : orgClock().date;
    return { date: on, amount: (await this.taxPayments.inputTaxAvailable(requireOrgId(session), on)).toString() };
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createTaxPaymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.taxPayments.recordPayment(requireOrgId(session), session.user.id, parsed.data);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async remove(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.taxPayments.remove(requireOrgId(session), session.user.id, id);
  }
}

@Controller("tax-refunds")
@OrgRoles(["owner"])
export class TaxRefundsController {
  constructor(private readonly taxPayments: TaxPaymentsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createTaxRefundSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.taxPayments.recordRefund(requireOrgId(session), session.user.id, parsed.data);
  }
}
