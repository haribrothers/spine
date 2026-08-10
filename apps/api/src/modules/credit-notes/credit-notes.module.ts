import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { CreditNotesController } from "./credit-notes.controller";
import { CreditNotesService } from "./credit-notes.service";

/** PRD F5 (S-05.6) — credit notes against an issued invoice. Imports NumberingModule for gapless credit-note numbering, LedgerModule for LedgerService (the same posting primitive InvoicesModule uses), AuditModule for audit-log writes. */
@Module({
  imports: [AuditModule, NumberingModule, LedgerModule],
  controllers: [CreditNotesController],
  providers: [CreditNotesService],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
