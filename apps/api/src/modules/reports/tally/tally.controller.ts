import { Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { putTallyMappingSchema, type PutTallyMapping, type TallyMappingRow } from "@spine/shared";
import { RequireCapability } from "../../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../../common/idempotency.interceptor";
import { ZodValidationPipe } from "../../../common/zod-validation.pipe";
import { requireOrgId } from "../../org/settings.controller";
import { TallyMappingService } from "./tally-mapping.service";

/** US-RPT-38/39 (D-149) — the Tally export and the account mapping it uses. */
@Controller("exports/tally")
export class TallyController {
  constructor(private readonly mapping: TallyMappingService) {}

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
