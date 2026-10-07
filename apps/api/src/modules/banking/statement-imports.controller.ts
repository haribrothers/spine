import { ArgumentsHost, BadRequestException, Body, Catch, Controller, Get, Param, ParseUUIDPipe, PayloadTooLargeException, Post, Query, UploadedFile, UseFilters, UseInterceptors, type ExceptionFilter } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { STATEMENT_MAX_BYTES, STATEMENT_TOO_BIG, statementLinesQuerySchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ReconciliationsService } from "./reconciliations.service";
import { StatementImportsService, type UploadedStatement } from "./statement-imports.service";

/** A statement over 2 MB says what to do instead of multer's "File too large". */
@Catch(PayloadTooLargeException)
class StatementSizeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(400).json({ statusCode: 400, message: STATEMENT_TOO_BIG, error: "Bad Request" });
  }
}

/** US-BANK-07 and US-BANK-11 — CSV statements and reconciliation history for a money account. `banking.reconcile`; Field never. */
@Controller("money-accounts/:id")
@OrgRoles(["owner", "staff"])
@RequireCapability("banking.reconcile")
export class StatementImportsController {
  constructor(
    private readonly imports: StatementImportsService,
    private readonly reconciliations: ReconciliationsService,
  ) {}

  /** US-BANK-11 — the account's finished reconciliations, newest first. */
  @Get("reconciliations")
  async reconciliationHistory(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.reconciliations.list(requireOrgId(session), id, "finished");
  }

  /** The column mapping saved by the last import, if any. */
  @Get("statement-mapping")
  async mapping(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.imports.mapping(requireOrgId(session), id);
  }

  @Post("statement-imports")
  @UseFilters(StatementSizeFilter)
  // A little headroom over 2 MB so the service's own check gives the message.
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: STATEMENT_MAX_BYTES + 1024 } }), IdempotencyInterceptor)
  async import(
    @Session() session: UserSession,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedStatement | undefined,
    @Body("mapping") mapping: unknown,
  ) {
    return this.imports.import(requireOrgId(session), session.user.id, id, file, mapping);
  }

  @Get("statement-lines")
  async lines(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Query() query: unknown) {
    const parsed = statementLinesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the filters and try again.");
    return this.imports.lines(requireOrgId(session), id, parsed.data);
  }
}
