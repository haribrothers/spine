import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createRecurringInvoiceSchema, updateRecurringInvoiceSchema, type CreateRecurringInvoiceInput } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { RecurringInvoicesService } from "./recurring-invoices.service";

function parse(schema: typeof createRecurringInvoiceSchema, body: unknown): CreateRecurringInvoiceInput {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? "Check the schedule and try again.");
  return result.data;
}

/**
 * US-INV-20–22 (D-092) — recurring invoices. Every route, reads included,
 * needs `invoices.manage_recurring` (Owners always have it; Field never
 * reaches money).
 */
@Controller("recurring-invoices")
@OrgRoles(["owner", "staff"])
@RequireCapability("invoices.manage_recurring")
export class RecurringInvoicesController {
  constructor(private readonly recurring: RecurringInvoicesService) {}

  @Get()
  async list(@Session() session: UserSession) {
    return this.recurring.list(requireOrgId(session));
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    return this.recurring.getOne(requireOrgId(session), id);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.recurring.create(requireOrgId(session), session.user.id, parse(createRecurringInvoiceSchema, body));
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    return this.recurring.update(requireOrgId(session), id, session.user.id, parse(updateRecurringInvoiceSchema, body));
  }
}
