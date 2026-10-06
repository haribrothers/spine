import { BadRequestException, Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { saveOpeningBalancesSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { OpeningBalancesService } from "./opening-balances.service";

/** US-RPT-16–US-RPT-19 — opening balances. Owner-only, never Team-configurable (07-security). */
@Controller("opening-balances")
@OrgRoles(["owner"])
export class OpeningBalancesController {
  constructor(private readonly openingBalances: OpeningBalancesService) {}

  @Get()
  async get(@Session() session: UserSession) {
    return this.openingBalances.get(requireOrgId(session));
  }

  @Put()
  @UseInterceptors(IdempotencyInterceptor)
  async save(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = saveOpeningBalancesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the balances and try again.");
    return this.openingBalances.save(requireOrgId(session), session.user.id, parsed.data);
  }
}
