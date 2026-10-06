import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { reconciliationListQuerySchema, saveReconciliationMatchesSchema, startReconciliationSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ReconciliationsService } from "./reconciliations.service";

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0]?.message ?? "Check the entry and try again.";

/** US-BANK-08–US-BANK-11 — reconciling a money account. `banking.reconcile`; Field never. */
@Controller("bank-reconciliations")
@OrgRoles(["owner", "staff"])
@RequireCapability("banking.reconcile")
export class ReconciliationsController {
  constructor(private readonly reconciliations: ReconciliationsService) {}

  @Get()
  async list(@Session() session: UserSession, @Query() query: unknown) {
    const parsed = reconciliationListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.reconciliations.list(requireOrgId(session), parsed.data.moneyAccountId, parsed.data.status);
  }

  /** Starts a reconciliation, or updates the end date and closing balance of the one in progress. */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async start(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = startReconciliationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.reconciliations.start(requireOrgId(session), session.user.id, parsed.data);
  }

  @Get(":id")
  async get(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.reconciliations.get(requireOrgId(session), id);
  }

  @Put(":id/matches")
  @UseInterceptors(IdempotencyInterceptor)
  async saveMatches(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = saveReconciliationMatchesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.reconciliations.saveMatches(requireOrgId(session), id, parsed.data);
  }
}
