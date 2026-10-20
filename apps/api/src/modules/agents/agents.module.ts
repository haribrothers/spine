import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { AgentRequestMiddleware } from "./agent-request.middleware";
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
import { AgentApi } from "./agent-api";
import { ReadTools } from "./tools/read-tools";
import { ReportTools } from "./tools/report-tools";
import { DraftTools } from "./tools/draft-tools";

/** Connected agents (D-256–D-259): the Owner's switch, and from US-MCP-03 the MCP server, sign-in and connections. */
@Module({
  imports: [OrgModule, AuditModule, NotificationsModule],
  controllers: [AgentsSettingsController, McpController, WellKnownController, AgentConsentController, MyAgentConnectionsController, OrgAgentConnectionsController],
  providers: [AgentsSettingsService, AgentConnectionsService, McpService, AgentApi,
    ReadTools,
    ReportTools,
    DraftTools,
    // The tools agents get, story by story (D-259).
    { provide: AGENT_TOOL_REGISTRARS, useFactory: (read: ReadTools, reports: ReportTools, drafts: DraftTools) => [read, reports, drafts], inject: [ReadTools, ReportTools, DraftTools] }],
  exports: [AgentsSettingsService],
})
export class AgentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AgentRequestMiddleware).forRoutes("*");
  }
}
