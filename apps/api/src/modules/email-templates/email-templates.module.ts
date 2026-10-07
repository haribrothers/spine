import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { EmailDocumentsService } from "./email-documents.service";
import { EmailDraftsController } from "./email-drafts.controller";
import { EmailTemplatePreviewController } from "./email-template-preview.controller";

/** US-SET-21/22 (D-153) — drafts for the "Send" dialogs, and the preview and test in Settings › Emails. */
@Module({
  imports: [EmailModule],
  controllers: [EmailDraftsController, EmailTemplatePreviewController],
  providers: [EmailDocumentsService],
  exports: [EmailDocumentsService],
})
export class EmailTemplatesModule {}
