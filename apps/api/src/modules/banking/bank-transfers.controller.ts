import { BadRequestException, Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseInterceptors } from "@nestjs/common";
import { createBankTransferSchema } from "@spine/shared";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { RequireCapability } from "../../auth/require-capability.decorator";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { BankTransfersService } from "./bank-transfers.service";

/** US-BANK-04 — transfers between money accounts. `banking.record`; Field never. */
@Controller("bank-transfers")
@OrgRoles(["owner", "staff"])
@RequireCapability("banking.record")
export class BankTransfersController {
  constructor(private readonly transfers: BankTransfersService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = createBankTransferSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the transfer and try again.");
    return this.transfers.create(requireOrgId(session), session.user.id, parsed.data);
  }

  @Delete(":id")
  @UseInterceptors(IdempotencyInterceptor)
  async remove(@Session() session: UserSession, @Param("id", ParseUUIDPipe) id: string) {
    return this.transfers.remove(requireOrgId(session), id, session.user.id);
  }
}
