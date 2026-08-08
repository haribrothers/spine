import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

/**
 * PRD F6 Stage 1 (Phase 2 · Money In) — record payments against a contact,
 * allocate across invoices (S-06.1, S-06.2, S-06.4, S-06.5), oldest-first
 * allocation suggestion (S-06.3). Receipt PDF (S-06.6) and the
 * receivables/AR-aging view (S-06.7) are a later stage. Imports
 * `NumberingModule` for gapless receipt numbering, `LedgerModule` for
 * `LedgerService` (the same posting/reversal primitive InvoicesModule
 * uses), and `AuditModule` for audit-log writes.
 */
@Module({
  imports: [AuditModule, NumberingModule, LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
