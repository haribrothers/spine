import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createVendorCreditSchema, updateVendorCreditSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorCreditsService } from "./vendor-credits.service";

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the vendor credit and try again.");
  return parsed.data;
}

/**
 * US-PUR-24/28 — vendor credits, shaped like VendorBillsController: reads
 * for Owners and Staff, own/others edit and delete checked in the service,
 * `vendor_credits.record` for the posting step. Field never.
 */
@Controller("vendor-credits")
@OrgRoles(["owner", "staff"])
export class VendorCreditsController {
  constructor(private readonly credits: VendorCreditsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query("status") status?: string, @Query("contactId") contactId?: string) {
    return this.credits.list(requireOrgId(session), { status, contactId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.getOne(requireOrgId(session), id);
  }

  @Get(":id/history")
  async history(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.getHistory(requireOrgId(session), id);
  }

  @Post()
  @RequireCapability("vendor_credits.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.credits.create(requireOrgId(session), session.user.id, parse(createVendorCreditSchema, body));
  }

  @Put(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.credits.update(requireOrgId(session), id, session.user.id, parse(updateVendorCreditSchema, body));
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.delete(requireOrgId(session), id, session.user.id);
  }

  @Post(":id/record")
  @RequireCapability("vendor_credits.record")
  @UseInterceptors(IdempotencyInterceptor)
  async record(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.credits.record(requireOrgId(session), id, session.user.id);
  }
}
