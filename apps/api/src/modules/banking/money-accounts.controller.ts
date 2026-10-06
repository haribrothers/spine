import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { accountRegisterQuerySchema, moneyAccountInputSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { hasCapability } from "../../auth/capability.util";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { requireOrgId } from "../org/settings.controller";
import { AccountRegisterService } from "./account-register.service";
import { MoneyAccountsService } from "./money-accounts.service";

function parseInput(body: unknown) {
  const parsed = moneyAccountInputSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the account and try again.");
  return parsed.data;
}

/**
 * US-BANK-01 — money accounts. Field never reaches a banking route (07
 * §Banking). Any Owner or Staff member can list account names for the
 * payment-form pickers; balances need `banking.view`. Adding and changing
 * accounts is Owner-only, like the chart of accounts.
 */
@Controller("money-accounts")
@OrgRoles(["owner", "staff"])
export class MoneyAccountsController {
  constructor(
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly registers: AccountRegisterService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  @Get()
  async list(@Session() session: UserSession, @Query("includeArchived") includeArchived?: string) {
    const orgId = requireOrgId(session);
    const withBalances = await hasCapability(this.db, { orgId, userId: session.user.id }, "banking.view");
    return this.moneyAccounts.list(orgId, { includeArchived: includeArchived === "true", withBalances });
  }

  @Get("next-codes")
  @OrgRoles(["owner"])
  async nextCodes(@Session() session: UserSession) {
    return this.moneyAccounts.nextCodes(requireOrgId(session));
  }

  /** US-BANK-02 — what moved through one account, with a running balance. */
  @Get(":id/register")
  @RequireCapability("banking.view")
  async register(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Query() query: unknown) {
    const parsed = accountRegisterQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    return this.registers.register(requireOrgId(session), id, parsed.data);
  }

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.moneyAccounts.create(requireOrgId(session), session.user.id, parseInput(body));
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.moneyAccounts.update(requireOrgId(session), id, session.user.id, parseInput(body));
  }
}
