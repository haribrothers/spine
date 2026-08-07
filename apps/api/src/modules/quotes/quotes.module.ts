import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { OrgModule } from "../org/org.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";

/**
 * PRD F3 Stage 1 — quote CRUD, line items, versioning, discount approval
 * (S-03.1, S-03.2, S-03.8, S-03.9, S-03.11). Imports `NumberingModule` for
 * gapless number allocation on send, `AuditModule` for audit-log writes on
 * every mutation, and `OrgModule` for `SettingsService` (the discount-
 * approval threshold, mirroring `default_tax_rate`'s own convention).
 * PDF/email/public-link/notifications/quote->job-invoice conversion are
 * Stage 2/3 — not wired here (see CHANGELOG).
 */
@Module({
  imports: [AuditModule, NumberingModule, OrgModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
