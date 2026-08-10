import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createVendorBillSchema, updateVendorBillSchema, voidVendorBillSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { VendorBillsService } from "./vendor-bills.service";

/** Per §2.1's permission table shape (Owner ✅ / Staff ✅ / Field ❌, same posture as InvoicesController) gated on the new `purchases.manage` capability. */
@Controller("vendor-bills")
@OrgRoles(["owner", "staff"])
export class VendorBillsController {
  constructor(private readonly vendorBillsService: VendorBillsService) {}

  @Get()
  async list(
    @Session() session: UserSession,
    @Query("status") status?: string,
    @Query("contactId") contactId?: string,
    @Query("jobId") jobId?: string,
  ) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.list(orgId, { status, contactId, jobId });
  }

  @Get(":id")
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.getOne(orgId, id);
  }

  @Post()
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createVendorBillSchema.parse(body);
    return this.vendorBillsService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateVendorBillSchema.parse(body);
    return this.vendorBillsService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/record")
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async record(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.record(orgId, id, session.user.id);
  }

  @Post(":id/void")
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async void(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = voidVendorBillSchema.parse(body);
    return this.vendorBillsService.void(orgId, id, session.user.id, input.reason);
  }

  @Delete(":id")
  @RequireCapability("purchases.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.vendorBillsService.delete(orgId, id, session.user.id);
  }
}
