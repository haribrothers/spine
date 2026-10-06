import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { LedgerModule } from "../ledger/ledger.module";
import { OrgModule } from "../org/org.module";
import { OpeningBalancesController } from "./opening-balances.controller";
import { OpeningBalancesService } from "./opening-balances.service";
import { OpeningDocumentsController } from "./opening-documents.controller";
import { OpeningInvoicesService } from "./opening-invoices.service";

/** US-RPT-16–US-RPT-19 (D-137) — the books a business brings into Spine. */
@Module({
  imports: [AuditModule, LedgerModule, OrgModule],
  controllers: [OpeningBalancesController, OpeningDocumentsController],
  providers: [OpeningBalancesService, OpeningInvoicesService],
  exports: [OpeningBalancesService],
})
export class OpeningBalancesModule {}
