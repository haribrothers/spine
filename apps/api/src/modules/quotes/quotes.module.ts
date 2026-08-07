import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { OrgModule } from "../org/org.module";
import { FilesModule } from "../files/files.module";
import { PdfModule } from "../pdf/pdf.module";
import { EmailModule } from "../email/email.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { QuoteEmailWorker } from "./quote-email.worker";

/**
 * PRD F3 Stage 1 + Stage 2 — quote CRUD, line items, versioning, discount
 * approval (S-03.1, S-03.2, S-03.8, S-03.9, S-03.11), plus PDF rendering
 * and email sending (S-03.3, S-03.4). Imports `NumberingModule` for
 * gapless number allocation on send, `AuditModule` for audit-log writes on
 * every mutation, `OrgModule` for `SettingsService` (discount-approval
 * threshold + business_profile branding), `PdfModule` for the quote PDF
 * renderer (shared between `GET /quotes/:id/pdf` and the send-email
 * worker), `FilesModule` for persisting the PDF generated at send time,
 * and `EmailModule` for the actual SMTP send. `QuoteEmailWorker` is a
 * provider (not exported — nothing outside this module calls it directly,
 * it self-registers with pg-boss via its own `onModuleInit`, see its file
 * for the full picture) rather than a controller, since it's a queue
 * consumer, not an HTTP endpoint.
 *
 * Public accept/reject link, view/accept/reject event tracking, and owner
 * notifications are Stage 3 — not wired here (see CHANGELOG).
 */
@Module({
  imports: [AuditModule, NumberingModule, OrgModule, FilesModule, PdfModule, EmailModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteEmailWorker],
  exports: [QuotesService],
})
export class QuotesModule {}
