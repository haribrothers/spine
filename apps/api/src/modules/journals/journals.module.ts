import { ReportsModule } from "../reports/reports.module";
import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { NumberingModule } from "../numbering/numbering.module";
import { ManualJournalsController } from "./manual-journals.controller";
import { ManualJournalsService } from "./manual-journals.service";

/** US-RPT-20–US-RPT-22 (D-134) — manual journals. */
@Module({
  imports: [AuditModule, LedgerModule, NumberingModule, ReportsModule],
  controllers: [ManualJournalsController],
  providers: [ManualJournalsService],
})
export class JournalsModule {}
