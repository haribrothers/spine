import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { sendStatementSchema, statementQuerySchema } from "@spine/shared";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { StatementDocumentsService } from "./statement-documents.service";
import { StatementsService } from "./statements.service";

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? "Check the statement period and try again.");
  return result.data;
}

/**
 * US-PAY-14/15 — customer statements. Money a customer owes is receivables
 * information, so every route needs `reports.view_receivables` (Owners
 * always; Staff by Team; Field never).
 */
@Controller("contacts/:id")
@OrgRoles(["owner", "staff"])
@RequireCapability("reports.view_receivables")
export class StatementsController {
  constructor(
    private readonly statements: StatementsService,
    private readonly documents: StatementDocumentsService,
  ) {}

  @Get("statement")
  async summary(@Session() session: UserSession, @Param("id") id: string, @Query() query: unknown) {
    return this.statements.build(requireOrgId(session), id, parse(statementQuerySchema, query));
  }

  /** US-SET-21 — the email the statement dialog starts from. */
  @Get("statement/draft")
  async draft(@Session() session: UserSession, @Param("id") id: string, @Query() query: unknown) {
    return this.documents.draft(requireOrgId(session), id, parse(statementQuerySchema, query));
  }

  @Get("statement.pdf")
  async pdf(@Session() session: UserSession, @Param("id") id: string, @Query() query: unknown, @Res() res: Response) {
    const { buffer, filename } = await this.documents.pdf(requireOrgId(session), id, parse(statementQuerySchema, query));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(buffer);
  }

  @Post("statement/send")
  @UseInterceptors(IdempotencyInterceptor)
  async send(@Session() session: UserSession, @Param("id") id: string, @Body() body: unknown) {
    return this.documents.send(requireOrgId(session), id, session.user.id, parse(sendStatementSchema, body));
  }
}
