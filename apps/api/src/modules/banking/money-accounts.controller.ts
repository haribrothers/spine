import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { accountRegisterQuerySchema, moneyAccountInputSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { hasCapability } from "../../auth/capability.util";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { requireOrgId } from "../org/settings.controller";
import { ReportExportService } from "../reports/export/report-export.service";
import { AccountRegisterService } from "./account-register.service";
import { registerDocument } from "./register-document";
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
    private readonly exporter: ReportExportService,
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

  /** US-BANK-03 — the account this person last used on each form, to preselect it. */
  @Get("last-used")
  async lastUsed(@Session() session: UserSession) {
    return this.moneyAccounts.lastUsed(session.user.id);
  }

  /**
   * US-BANK-02 — what moved through one account, with a running balance.
   * US-BANK-14: `format=csv|xlsx|pdf` downloads the rows on screen (the
   * range, Unreconciled only, `type` and `search`).
   */
  @Get(":id/register")
  @RequireCapability("banking.view")
  async register(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Query() query: unknown) {
    const parsed = accountRegisterQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the dates and try again.");
    const orgId = requireOrgId(session);
    const register = await this.registers.register(orgId, id, parsed.data);
    if (!parsed.data.format) return register;
    return this.exporter.file(orgId, parsed.data.format, registerDocument(register, { type: parsed.data.type, search: parsed.data.search }));
  }

  /** US-BANK-16 — where the imported statement ends, to start reconciling from. */
  @Get(":id/statement-end")
  @RequireCapability("banking.reconcile")
  async statementEnd(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.moneyAccounts.statementEnd(requireOrgId(session), id);
  }

  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    return this.moneyAccounts.create(requireOrgId(session), session.user.id, parseInput(body));
  }

  /** US-BANK-06 — archive an account with a zero balance that isn't the default. */
  @Post(":id/archive")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async archive(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.moneyAccounts.archive(requireOrgId(session), id, session.user.id);
  }

  @Post(":id/restore")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async restore(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.moneyAccounts.restore(requireOrgId(session), id, session.user.id);
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async update(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.moneyAccounts.update(requireOrgId(session), id, session.user.id, parseInput(body));
  }
}
