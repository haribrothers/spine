import { Body, Controller, Get, Param, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { AccountsService } from "./accounts.service";
import { requireOrgId } from "./settings.controller";

@Controller("org/accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async list(@Session() session: UserSession) {
    const orgId = requireOrgId(session);
    return this.accountsService.listGroupedByType(orgId);
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async rename(@Session() session: UserSession, @Param("id") id: string, @Body("name") name: string) {
    const orgId = requireOrgId(session);
    return this.accountsService.rename(orgId, id, name);
  }
}
