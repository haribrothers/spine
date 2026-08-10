import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { QuotesModule } from "../quotes/quotes.module";
import { OrgModule } from "../org/org.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";
import { VariationOrdersService } from "./variation-orders.service";
import { JobCostingService } from "./job-costing.service";

/**
 * PRD F4 (Phase 3 · Jobs & Construction Billing) — Stage 1: job CRUD,
 * job-from-accepted-quote conversion (S-04.1), milestone definition with
 * 100%-total validation (S-04.2/S-04.3). Stage 2: milestone completion
 * with photos (S-04.4), progress invoicing from a completed milestone
 * (S-04.5), retention hold (S-04.6, via InvoicesService.issue) and release
 * (S-04.7, via InvoicesService.releaseRetention) — both of which is why
 * this module imports `InvoicesModule`. Stage 3: variation orders as
 * supplementary quotes linked to a job (S-04.9, via `QuotesModule` for
 * `QuotesService` — VariationOrdersService never duplicates quote CRUD),
 * general job photos/notes (S-04.10, on `JobsService` itself), and job
 * cost/revenue/margin (S-04.8, revenue side only — see JobCostingService's
 * own doc comment on why cost is still always 0 until Phase 4). Imports
 * `OrgModule` directly (not just transitively via `InvoicesModule`, which
 * doesn't re-export it) for `QuoteConversionGuardService` — the org's
 * warn/block preference on accidental repeat quote conversion, shared
 * with `InvoicesService.convertFromQuote`.
 */
@Module({
  imports: [AuditModule, InvoicesModule, QuotesModule, OrgModule],
  controllers: [JobsController],
  providers: [JobsService, MilestonesService, VariationOrdersService, JobCostingService],
  exports: [JobsService, MilestonesService, VariationOrdersService],
})
export class JobsModule {}
