import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseInterceptors } from "@nestjs/common";
import { createBankTransactionSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { BankTransactionsService } from "./bank-transactions.service";

/** US-BANK-05 — money in or out with no invoice or bill. `banking.record`; Field never. */
@Controller("bank-transactions")
@OrgRoles(["owner", "staff"])
@RequireCapability("banking.record")
export class BankTransactionsController {
  constructor(private readonly transactions: BankTransactionsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createBankTransactionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the entry and try again.");
    return this.transactions.create(requireOrgId(session), session.user.id, parsed.data);
  }

  /** US-BANK-14 — one entry, for the register's drawer: seeing it needs only `banking.view`. */
  @Get(":id")
  @RequireCapability("banking.view")
  async getOne(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.transactions.getOne(requireOrgId(session), id);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async remove(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.transactions.remove(requireOrgId(session), id, session.user.id);
  }
}
