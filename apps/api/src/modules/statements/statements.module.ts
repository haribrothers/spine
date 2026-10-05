import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { FilesModule } from "../files/files.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OrgModule } from "../org/org.module";
import { StatementDocumentsService } from "./statement-documents.service";
import { StatementsController } from "./statements.controller";
import { StatementsService } from "./statements.service";

/** US-PAY-14/15 — customer statements (summary, PDF, email). */
@Module({
  imports: [AuditModule, EmailModule, FilesModule, LedgerModule, OrgModule],
  controllers: [StatementsController],
  providers: [StatementsService, StatementDocumentsService],
})
export class StatementsModule {}
