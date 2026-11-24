import { BadRequestException, Body, Controller, Get, Put, Query, StreamableFile, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { putTallyMappingSchema, type PutTallyMapping, type TallyMappingRow } from "@spine/shared";
import { RequireCapability } from "../../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../../common/zod-validation.pipe";
import { requireOrgId } from "../../org/settings.controller";
import { TallyExportService } from "./tally-export.service";
import { TallyMappingService } from "./tally-mapping.service";

/** US-RPT-38/39 (D-149) — the Tally export and the account mapping it uses. */
@Controller("exports/tally")
export class TallyController {
  constructor(
    private readonly mapping: TallyMappingService,
    private readonly exporter: TallyExportService,
  ) {}

  /** US-RPT-38 — the ZIP for a date range, or `format=summary` for the page. */
  @Get()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async export(@Session() session: UserSession, @Query("from") from: string, @Query("to") to: string, @Query("format") format = "zip") {
    const orgId = requireOrgId(session);
    if (format === "summary") return this.exporter.summary(orgId, from, to);
    if (format !== "zip") throw new BadRequestException("Choose summary or zip.");
    const file = await this.exporter.zip(orgId, session.user.id, from, to);
    return new StreamableFile(file.body, { type: "application/zip", disposition: `attachment; filename="${file.filename}"` });
  }

  /** Each account with its Tally group; readable by anyone who can export. */
  @Get("mapping")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("reports.view_financial_statements")
  async getMapping(@Session() session: UserSession): Promise<TallyMappingRow[]> {
    return this.mapping.rows(requireOrgId(session));
  }

  /** Changing the mapping is Owner-only. */
  @Put("mapping")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async putMapping(@Session() session: UserSession, @Body(new ZodValidationPipe(putTallyMappingSchema)) body: PutTallyMapping): Promise<TallyMappingRow[]> {
    return this.mapping.save(requireOrgId(session), body);
  }
}
