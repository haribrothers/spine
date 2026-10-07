import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { EmailDocumentsService } from "./email-documents.service";
import { EmailDraftsController } from "./email-drafts.controller";

/** US-SET-21/22 (D-153) — drafts for the "Send" dialogs, and the preview and test in Settings › Emails. */
@Module({
  imports: [EmailModule],
  controllers: [EmailDraftsController],
  providers: [EmailDocumentsService],
  exports: [EmailDocumentsService],
})
export class EmailTemplatesModule {}
