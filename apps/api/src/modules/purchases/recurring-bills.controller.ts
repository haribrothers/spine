import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createRecurringBillSchema, updateRecurringBillSchema, type CreateRecurringBillInput } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { RecurringBillsService } from "./recurring-bills.service";

function parse(schema: typeof createRecurringBillSchema, body: unknown): CreateRecurringBillInput {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? "Check the schedule and try again.");
  return result.data;
}

/**
 * US-PUR-29–31 (D-159) — recurring bills. Every route, reads included,
 * needs `vendor_bills.manage_recurring` (Owners always have it; Field never
 * reaches money).
 */
@Controller("recurring-bills")
@OrgRoles(["owner", "staff"])
@RequireCapability("vendor_bills.manage_recurring")
export class RecurringBillsController {
  constructor(private readonly recurring: RecurringBillsService) {}

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
    return this.recurring.create(requireOrgId(session), session.user.id, parse(createRecurringBillSchema, body));
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    return this.recurring.update(requireOrgId(session), id, session.user.id, parse(updateRecurringBillSchema, body));
  }

  /** US-PUR-31 */
  @Post(":id/pause")
  @UseInterceptors(IdempotencyInterceptor)
  async pause(@Session() session: UserSession, @Param("id") id: string) {
    return this.recurring.pause(requireOrgId(session), id, session.user.id);
  }

  @Post(":id/resume")
  @UseInterceptors(IdempotencyInterceptor)
  async resume(@Session() session: UserSession, @Param("id") id: string) {
    return this.recurring.resume(requireOrgId(session), id, session.user.id);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    return this.recurring.delete(requireOrgId(session), id, session.user.id);
  }
}
