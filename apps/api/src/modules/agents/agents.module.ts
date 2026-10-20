import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrgModule } from "../org/org.module";
import { AgentsSettingsController } from "./agents.controller";
import { AgentsSettingsService } from "./agents-settings.service";

/** Connected agents (D-256–D-259): the Owner's switch, and from US-MCP-03 the MCP server, sign-in and connections. */
@Module({
  imports: [OrgModule, AuditModule],
  controllers: [AgentsSettingsController],
  providers: [AgentsSettingsService],
  exports: [AgentsSettingsService],
})
export class AgentsModule {}
