import { Controller, Delete, Get, HttpCode, Param, UseInterceptors } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { IdempotencyInterceptor } from "../../common/idempotency.interceptor";
import { requireOrgId } from "../org/settings.controller";
import { AgentConnectionsService } from "./agent-connections.service";

/** US-MCP-04 — Settings › Your account › Connected agents: anyone's own. Owned by the agents module (refused while it's off). */
@Controller("agents/connections")
export class MyAgentConnectionsController {
  constructor(private readonly connections: AgentConnectionsService) {}

  @Get()
  async mine(@Session() session: UserSession) {
    return this.connections.mine(requireOrgId(session), session.user.id);
  }

  @Delete(":id")
  @HttpCode(204)
  @UseInterceptors(IdempotencyInterceptor)
  async disconnect(@Session() session: UserSession, @Param("id") id: string) {
    await this.connections.disconnectMine(requireOrgId(session), session.user.id, id);
  }
}

/** US-MCP-04 — the Owner's list of every connection, and ending anyone's. */
@Controller("org/agents/connections")
export class OrgAgentConnectionsController {
  constructor(private readonly connections: AgentConnectionsService) {}

  @Get()
  @OrgRoles(["owner"])
  async all(@Session() session: UserSession) {
    return this.connections.all(requireOrgId(session));
  }

  @Delete(":id")
  @HttpCode(204)
  @OrgRoles(["owner"])
  @UseInterceptors(IdempotencyInterceptor)
  async disconnect(@Session() session: UserSession, @Param("id") id: string) {
    await this.connections.disconnectAny(requireOrgId(session), session.user.id, id);
  }
}
