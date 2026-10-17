import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgModule } from "../org/org.module";
import { AiController, AiSettingsController } from "./ai.controller";
import { AiSettingsService } from "./ai-settings.service";
import { AiRequestService } from "./ai-request.service";
import { AiHttp } from "./drivers";

/** The optional AI assistant (D-162–D-173): its settings, its provider drivers and, from US-AI-08 on, its features. */
@Module({
  imports: [OrgModule, AuditModule, NotificationsModule],
  controllers: [AiSettingsController, AiController],
  providers: [AiSettingsService, AiRequestService, AiHttp],
  exports: [AiSettingsService, AiRequestService],
})
export class AiModule {}
