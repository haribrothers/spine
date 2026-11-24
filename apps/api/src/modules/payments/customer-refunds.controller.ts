import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseInterceptors } from "@nestjs/common";
import { createCustomerRefundSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { CustomerRefundsService } from "./customer-refunds.service";

/** US-PAY-17/18 — customer refunds. Reading like payments; refunding and deleting need `payments.refund`. Field never. */
@Controller("customer-refunds")
@OrgRoles(["owner", "staff"])
export class CustomerRefundsController {
  constructor(private readonly refunds: CustomerRefundsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("contactId") contactId?: string) {
    return this.refunds.list(requireOrgId(session), contactId);
  }

  @Post()
  @RequireCapability("payments.refund")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createCustomerRefundSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the refund and try again.");
    return this.refunds.create(requireOrgId(session), session.user.id, parsed.data);
  }

  @Delete(":id")
  @RequireCapability("payments.refund")
  @UseInterceptors(IdempotencyInterceptor)
  async remove(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.refunds.remove(requireOrgId(session), id, session.user.id);
  }
}
