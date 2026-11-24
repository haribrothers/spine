import { Body, Controller, Get, Param, Post, Put, UseInterceptors } from "@nestjs/common";
import { createAccountSchema } from "@spine/shared";
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

  /** S-09.9 — Owner-only, same category as tax rules/org settings management per Spine's permission model. */
  @Post()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const orgId = requireOrgId(session);
    const input = createAccountSchema.parse(body);
    return this.accountsService.create(orgId, input);
  }

  @Put(":id")
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async rename(@Session() session: UserSession, @Param("id") id: string, @Body("name") name: string) {
    const orgId = requireOrgId(session);
    return this.accountsService.rename(orgId, id, name);
  }
}
