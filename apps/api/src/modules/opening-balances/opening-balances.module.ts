import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { NumberingModule } from "../numbering/numbering.module";
import { OrgModule } from "../org/org.module";
import { OpeningBillsService } from "./opening-bills.service";
import { OpeningBalancesController } from "./opening-balances.controller";
import { OpeningBalancesService } from "./opening-balances.service";
import { OpeningDocumentsController } from "./opening-documents.controller";
import { OpeningInvoicesService } from "./opening-invoices.service";

/** US-RPT-16–US-RPT-19 (D-137) — the books a business brings into Spine. */
@Module({
  imports: [AuditModule, LedgerModule, OrgModule, NumberingModule],
  controllers: [OpeningBalancesController, OpeningDocumentsController],
  providers: [OpeningBalancesService, OpeningInvoicesService, OpeningBillsService],
  exports: [OpeningBalancesService],
})
export class OpeningBalancesModule {}
