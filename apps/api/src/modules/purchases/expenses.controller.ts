import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { bulkIdsSchema, bulkRejectSchema, createExpenseSchema, rejectExpenseSchema, reviewExpenseSchema, updateExpenseSchema } from "@spine/shared";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./expenses.dto";

/**
 * Per §2.1's permission table ("Submit expense: Owner ✅, Staff ✅
 * (default), Field ✅"; "Approve expense: Owner ✅, Staff ✅ (default),
 * Field ❌"). List/get/create/update/delete are all Field-reachable
 * (a field user needs to see and edit their own still-submitted
 * expenses); approve/reject are owner+staff only. No class-level
 * `@OrgRoles` — each route declares its own, since the eligible role set
 * genuinely differs by action here (unlike InvoicesController's uniform
 * owner+staff).
 *
 * Own/others split (PRD §9): `expenses.submit`/`expenses.approve` are
 * replaced by `expenses.edit_own`/`edit_others`/`delete_own`/
 * `delete_others` (create/update/delete, checked in `ExpensesService` via
 * `requireOwnershipCapability` once the record is loaded — see
 * contacts.controller.ts's own header comment for why this can't be a
 * route-level `@RequireCapability`) plus dedicated `expenses.approve`/
 * `expenses.reject`/`expenses.mark_billed`/`expenses.bill_to_customer`
 * (an approver reviewing someone else's submission, or a billing action,
 * is not an "edit" relationship, so these stay single capabilities, not
 * own/others). Field ALWAYS passes the `_own` half of edit/delete for
 * their own expense — Field is fixed/non-configurable and never
 * participates in the Team privilege matrix, so this preserves today's
 * "field can submit/edit/delete their own expenses" behavior rather than
 * silently taking it away (see `hasCapability`'s `fieldAlwaysPasses` param).
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
    // Field always sees only their own expenses, whatever `mine` says (US-OPS-20).
    const scope = await this.expensesService.readScope(orgId, session.user.id);
    // US-PUR-22: Field can only filter by a job they're assigned to.
    if (scope && jobId && !(await this.expensesService.isAssigned(orgId, session.user.id, jobId))) return [];
    return this.expensesService.list(orgId, { status, jobId, submittedByUserId: scope ?? (mine === "true" ? session.user.id : undefined) });
  }

  @Get(":id")
  @OrgRoles(["owner", "staff", "field"])
  async getOne(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.getOne(orgId, id, await this.expensesService.readScope(orgId, session.user.id));
  }

  /** `GET /expenses/:id/history` — a real read against AuditLogService.record()'s existing writes (`entityType: "expense"`), same pattern as InvoicesController.getHistory. No `@RequireCapability` — a read, matching every other GET in this controller. */
  @Get(":id/history")
  @OrgRoles(["owner", "staff", "field"])
  async getHistory(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.getHistory(orgId, id, await this.expensesService.readScope(orgId, session.user.id));
  }

  @Post()
  @OrgRoles(["owner", "staff", "field"])
  @RequireCapability("expenses.edit_own")
  @UseInterceptors(IdempotencyInterceptor)
  @ApiBody({ type: CreateExpenseDto })
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createExpenseSchema.parse(body);
    return this.expensesService.create(orgId, session.user.id, input);
  }

  @Put(":id")
  @OrgRoles(["owner", "staff", "field"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = updateExpenseSchema.parse(body);
    return this.expensesService.update(orgId, id, session.user.id, input);
  }

  /** US-PUR-21 (D-097) — approve up to 100 submitted expenses; each posts its own journal entry. */
  @Post("bulk/approve")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.approve")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkApprove(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = bulkIdsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select 100 or fewer.");
    return this.expensesService.bulkReview(requireOrgId(session), session.user.id, parsed.data.ids, { approve: true });
  }

  /** US-PUR-21 — reject up to 100 submitted expenses with one comment. */
  @Post("bulk/reject")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.reject")
  @UseInterceptors(IdempotencyInterceptor)
  async bulkReject(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = bulkRejectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Select 100 or fewer.");
    return this.expensesService.bulkReview(requireOrgId(session), session.user.id, parsed.data.ids, { approve: false, comment: parsed.data.comment });
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
  @RequireCapability("expenses.reject")
  @UseInterceptors(IdempotencyInterceptor)
  async reject(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = rejectExpenseSchema.parse(body);
    return this.expensesService.reject(orgId, id, session.user.id, input.comment);
  }

  @Post(":id/mark-billed")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.mark_billed")
  @UseInterceptors(IdempotencyInterceptor)
  async markBilled(@Session() session: UserSession, @Param("id") id: string, @Body() body: { invoiceLineId: string }) {
    const orgId = requireOrgId(session);
    return this.expensesService.markBilled(orgId, id, session.user.id, body.invoiceLineId);
  }

  /** S-07.6's one-click UI action — creates a new draft invoice for this expense's job's contact and marks the expense billed in one call, unlike mark-billed above which expects an invoice line to already exist. */
  @Post(":id/bill-to-customer")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("expenses.bill_to_customer")
  @UseInterceptors(IdempotencyInterceptor)
  async billToCustomer(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.createInvoiceFromExpense(orgId, id, session.user.id);
  }

  @Delete(":id")
  @OrgRoles(["owner", "staff", "field"])
  @UseInterceptors(IdempotencyInterceptor)
  async delete(@Session() session: UserSession, @Param("id") id: string) {
    const orgId = requireOrgId(session);
    return this.expensesService.delete(orgId, id, session.user.id);
  }
}
