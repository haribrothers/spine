import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors, Res } from "@nestjs/common";
import { reconciliationListQuerySchema, saveReconciliationMatchesSchema, startReconciliationSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ReconciliationsService } from "./reconciliations.service";
import { ReconciliationReportService } from "./reconciliation-report.service";
import type { Response } from "express";

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0]?.message ?? "Check the entry and try again.";

/** US-BANK-08–US-BANK-11 — reconciling a money account. `banking.reconcile`; Field never. */
@Controller("bank-reconciliations")
@OrgRoles(["owner", "staff"])
@RequireCapability("banking.reconcile")
export class ReconciliationsController {
  constructor(
    private readonly reconciliations: ReconciliationsService,
    private readonly reports: ReconciliationReportService,
  ) {}

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

  /** US-BANK-17 — the reconciliation as a PDF report, generated when asked for. */
  @Get(":id/report.pdf")
  async report(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const { buffer, filename } = await this.reports.pdf(requireOrgId(session), id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
  }

  @Put(":id/matches")
  @UseInterceptors(IdempotencyInterceptor)
  async saveMatches(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = saveReconciliationMatchesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(firstIssue(parsed.error));
    return this.reconciliations.saveMatches(requireOrgId(session), id, parsed.data);
  }

  @Post(":id/finish")
  @UseInterceptors(IdempotencyInterceptor)
  async finish(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.reconciliations.finish(requireOrgId(session), session.user.id, id);
  }

  /** US-BANK-11 — only the most recent finished reconciliation of an account. */
  @Post(":id/undo")
  @UseInterceptors(IdempotencyInterceptor)
  async undo(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.reconciliations.undo(requireOrgId(session), session.user.id, id);
  }
}
