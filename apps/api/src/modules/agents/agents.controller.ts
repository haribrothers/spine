import { BadRequestException, Body, Controller, Get, Put, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { agentsSettingsUpdateSchema } from "@spine/shared";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { AgentsSettingsService } from "./agents-settings.service";

/** US-MCP-02 (D-256, D-258) — Settings › Connected agents. Owner-only, always reachable: it's where agents are switched on. */
@Controller("org/agents")
export class AgentsSettingsController {
  constructor(private readonly agents: AgentsSettingsService) {}

  @Get()
  @OrgRoles(["owner"])
  async get(@Session() session: UserSession) {
    return this.agents.get(requireOrgId(session));
  }

  @Put()
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async put(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = agentsSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check the settings and try again.");
    return this.agents.update(requireOrgId(session), session.user.id, parsed.data);
  }
}
