import { BadRequestException, Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { moduleSettingsSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "./settings.controller";
import { ModulesService } from "./modules.service";

/** US-SET-23 (D-154) — any member reads which modules are on (the UI needs it); only an Owner switches them. */
@Controller("org/modules")
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  async get(@Session() session: UserSession) {
    return this.modules.get(requireOrgId(session));
  }

  @Put()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async put(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = moduleSettingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Send every module's switch: leadsMeetings, jobsField, approvals and recurring.");
    return this.modules.update(requireOrgId(session), session.user.id, parsed.data);
  }
}
