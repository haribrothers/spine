import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailTemplatesModule } from "../email-templates/email-templates.module";
import { StatementsModule } from "../statements/statements.module";
import { FilesModule } from "../files/files.module";
import { TaxModule } from "../tax/tax.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgModule } from "../org/org.module";
import { AiController, AiSettingsController } from "./ai.controller";
import { AiSettingsService } from "./ai-settings.service";
import { AiRequestService } from "./ai-request.service";
import { AiHttp } from "./drivers";
import { DraftEmailService } from "./draft-email/draft-email.service";
import { ReadDocumentService } from "./read-document/read-document.service";
import { ReadReceiptService } from "./read-document/read-receipt.service";

/** The optional AI assistant (D-162–D-173): its settings, its provider drivers and, from US-AI-08 on, its features. */
@Module({
  imports: [OrgModule, AuditModule, NotificationsModule, FilesModule, TaxModule, EmailTemplatesModule, StatementsModule],
  controllers: [AiSettingsController, AiController],
  providers: [AiSettingsService, AiRequestService, AiHttp, ReadDocumentService, ReadReceiptService, DraftEmailService],
  exports: [AiSettingsService, AiRequestService],
})
export class AiModule {}
