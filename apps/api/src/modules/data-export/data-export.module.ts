import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { FilesModule } from "../files/files.module";
import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";
import { DataExportWorker } from "./data-export.worker";

/** US-SET-15/16 (D-094) — Settings › Data export. */
@Module({
  imports: [AuditModule, EmailModule, FilesModule],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportWorker],
})
export class DataExportModule {}
