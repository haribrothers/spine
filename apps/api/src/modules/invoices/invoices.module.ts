import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PdfModule } from "../pdf/pdf.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

/**
 * PRD F5 Stage 1 (Phase 2 · Money In) — invoice CRUD, issue with ledger
 * posting per §7.2, void with a reversing posting (S-05.1 scratch path,
 * S-05.2, S-05.3, S-05.8), PDF rendering (S-05.7's PDF half — emailing is a
 * later stage). Imports `NumberingModule` for gapless number allocation on
 * issue, `LedgerModule` for `LedgerService` (the shared posting/reversal
 * primitive every domain module posts through, per CLAUDE.md's "posting
 * rules live in one module"), `AuditModule` for audit-log writes, and
 * `PdfModule` for the invoice PDF renderer.
 */
@Module({
  imports: [AuditModule, NumberingModule, LedgerModule, PdfModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
