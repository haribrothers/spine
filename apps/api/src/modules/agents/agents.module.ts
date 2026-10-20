import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrgModule } from "../org/org.module";
import { AgentsSettingsController } from "./agents.controller";
import { AgentsSettingsService } from "./agents-settings.service";
import { McpController, WellKnownController } from "./mcp.controller";
import { AgentConsentController } from "./agent-consent.controller";
import { MyAgentConnectionsController, OrgAgentConnectionsController } from "./agent-connections.controller";
import { AgentConnectionsService } from "./agent-connections.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AGENT_TOOL_REGISTRARS, McpService } from "./mcp.service";
import type { AgentToolRegistrar } from "./mcp-context";

/** The tools agents get, added story by story (US-MCP-05 onwards). */
const registrars: AgentToolRegistrar[] = [];

/** Connected agents (D-256–D-259): the Owner's switch, and from US-MCP-03 the MCP server, sign-in and connections. */
@Module({
  imports: [OrgModule, AuditModule, NotificationsModule],
  controllers: [AgentsSettingsController, McpController, WellKnownController, AgentConsentController, MyAgentConnectionsController, OrgAgentConnectionsController],
  providers: [AgentsSettingsService, AgentConnectionsService, McpService, { provide: AGENT_TOOL_REGISTRARS, useValue: registrars }],
  exports: [AgentsSettingsService],
})
export class AgentsModule {}
