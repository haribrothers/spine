import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createExpenseSchema, rejectExpenseSchema, reviewExpenseSchema, updateExpenseSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ExpensesService } from "./expenses.service";

/**
 * Per §2.1's permission table ("Submit expense: Owner ✅, Staff ✅
 * (default), Field ✅"; "Approve expense: Owner ✅, Staff ✅ (default),
 * Field ❌"). List/get/create/update/delete are all Field-reachable
 * (a field user needs to see and edit their own still-submitted
 * expenses); approve/reject are owner+staff only. No class-level
 * `@OrgRoles` — each route declares its own, since the eligible role set
 * genuinely differs by action here (unlike InvoicesController's uniform
 * owner+staff).
 */
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @OrgRoles(["owner", "staff", "field"])
  async list(
    @Session() session: UserSession,
    @Query("status") status?: string,
    @Query("jobId") jobId?: string,
    @Query("mine") mine?: string,
  ) {
    const orgId = requireOrgId(session);
    return this.expensesService.list(orgId, { status, jobId, submittedByUserId: mine === "true" ? session.user.id : undefined });
  }

  @Get(":id")
  @OrgRoles(["owner", "staff", "field"])
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.getOne(orgId, id);
  }

  @Post()
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("expenses.submit")
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createExpenseSchema.parse(body);
    return this.expensesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("expenses.submit")
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateExpenseSchema.parse(body);
    return this.expensesService.update(orgId, id, session.user.id, input);
  }

  @Post(":id/approve")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.approve")
  @UseInterceptors(IdempotencyInterceptor)
  async approve(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = reviewExpenseSchema.parse(body);
    return this.expensesService.approve(orgId, id, session.user.id, input.comment ?? null);
  }

  @Post(":id/reject")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.approve")
  @UseInterceptors(IdempotencyInterceptor)
  async reject(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = rejectExpenseSchema.parse(body);
    return this.expensesService.reject(orgId, id, session.user.id, input.comment);
  }

  @Post(":id/mark-billed")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async markBilled(@Session() session: UserSession, @Param("id") id: string, @Body() body: { invoiceLineId: string }) {
    const orgId = requireOrgId(session);
    return this.expensesService.markBilled(orgId, id, session.user.id, body.invoiceLineId);
  }

  /** S-07.6's one-click UI action — creates a new draft invoice for this expense's job's contact and marks the expense billed in one call, unlike mark-billed above which expects an invoice line to already exist. */
  @Post(":id/bill-to-customer")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("invoices.manage")
  @UseInterceptors(IdempotencyInterceptor)
  async billToCustomer(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.createInvoiceFromExpense(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("expenses.submit")
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.delete(orgId, id, session.user.id);
  }
}
