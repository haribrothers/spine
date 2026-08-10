import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";

/**
 * PRD F4 (Phase 3 · Jobs & Construction Billing) — Stage 1: job CRUD,
 * job-from-accepted-quote conversion (S-04.1), and milestone definition
 * with 100%-total validation (S-04.2/S-04.3). Milestone completion (S-04.4),
 * progress invoicing (S-04.5), retention (S-04.6/S-04.7), variation orders
 * (S-04.9), and site photos (S-04.10) land in later stages — see CHANGELOG.
 */
@Module({
  imports: [AuditModule],
  controllers: [JobsController],
  providers: [JobsService, MilestonesService],
  exports: [JobsService, MilestonesService],
})
export class JobsModule {}
