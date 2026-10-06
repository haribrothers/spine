import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, UseInterceptors } from "@nestjs/common";
import { createManualJournalSchema, reverseManualJournalSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { ManualJournalsService } from "./manual-journals.service";

/** US-RPT-20–US-RPT-22 (D-134) — journals: posted and reversed by an Owner only; read by an Owner or with `ledger.view`. Field never. */
@Controller("manual-journals")
export class ManualJournalsController {
  constructor(private readonly journals: ManualJournalsService) {}

  @Get()
  @OrgRoles(["owner", "staff"])
  @RequireCapability("ledger.view")
  async list(@Session() session: UserSession) {
    return this.journals.list(requireOrgId(session));
  }

  @Get(":id")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("ledger.view")
  async get(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.journals.get(requireOrgId(session), id);
  }

  @Get(":id/history")
  @OrgRoles(["owner", "staff"])
  @RequireCapability("ledger.view")
  async history(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.journals.getHistory(requireOrgId(session), id);
  }

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createManualJournalSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the journal and try again.");
    return this.journals.create(requireOrgId(session), session.user.id, parsed.data);
  }

  /** US-RPT-21 */
  @Post(":id/reverse")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async reverse(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = reverseManualJournalSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the reversal and try again.");
    return this.journals.reverse(requireOrgId(session), session.user.id, id, parsed.data);
  }
}
