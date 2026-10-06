import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { FilesModule } from "../files/files.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";

/** US-OPS-33–US-OPS-35 (D-156): files kept with quotes, invoices, bills, expenses, bank entries and contacts. */
@Module({
  imports: [AuditModule, FilesModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
