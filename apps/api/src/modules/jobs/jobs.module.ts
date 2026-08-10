import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";

/**
 * PRD F4 (Phase 3 · Jobs & Construction Billing) — Stage 1: job CRUD,
 * job-from-accepted-quote conversion (S-04.1), milestone definition with
 * 100%-total validation (S-04.2/S-04.3). Stage 2: milestone completion
 * with photos (S-04.4), progress invoicing from a completed milestone
 * (S-04.5), retention hold (S-04.6, via InvoicesService.issue) and release
 * (S-04.7, via InvoicesService.releaseRetention) — both of which is why
 * this module now imports `InvoicesModule` (MilestonesService.invoiceMilestone
 * and JobsController.releaseRetention both call into `InvoicesService`
 * directly rather than duplicating posting logic). Variation orders
 * (S-04.9) and site photos (S-04.10) land in Stage 3 — see CHANGELOG.
 */
@Module({
  imports: [AuditModule, InvoicesModule],
  controllers: [JobsController],
  providers: [JobsService, MilestonesService],
  exports: [JobsService, MilestonesService],
})
export class JobsModule {}
