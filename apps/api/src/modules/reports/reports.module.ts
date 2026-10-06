import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { LedgerIntegrityService } from "./ledger-integrity.service";
import { CashFlowService } from "./cash-flow.service";
import { LedgerReportsService } from "./ledger-reports.service";
import { LedgerSourcesService } from "./ledger-sources.service";
import { NotificationsModule } from "../notifications/notifications.module";

/**
 * PRD F9 (Phase 2 · Money In half) — S-06.7 / S-09.5's receivables-with-
 * aging-buckets report. First real module here; P&L/Balance Sheet
 * (Owner-only, per §S-11.8) are a later phase's addition to this same
 * module rather than a new one.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, LedgerIntegrityService, LedgerReportsService, LedgerSourcesService, CashFlowService],
  exports: [ReportsService, LedgerSourcesService],
})
export class ReportsModule {}
