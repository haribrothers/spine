import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PdfModule } from "../pdf/pdf.module";
import { EmailModule } from "../email/email.module";
import { FilesModule } from "../files/files.module";
import { OrgModule } from "../org/org.module";
import { TaxModule } from "../tax/tax.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceEmailWorker } from "./invoice-email.worker";
import { InvoiceRemindersController } from "./invoice-reminders.controller";
import { InvoiceRemindersService } from "./invoice-reminders.service";

/**
 * PRD F5 Stage 1 (Phase 2 · Money In) — invoice CRUD, issue with ledger
 * posting per §7.2, void with a reversing posting (S-05.1 scratch path,
 * S-05.2, S-05.3, S-05.8), PDF rendering + emailing (S-05.7, now complete —
 * `InvoiceEmailWorker` is a queue consumer provider, not exported/a
 * controller, self-registering with pg-boss via its own `onModuleInit`,
 * mirroring `QuoteEmailWorker`'s exact shape). Imports `NumberingModule`
 * for gapless number allocation on issue, `LedgerModule` for
 * `LedgerService` (the shared posting/reversal primitive every domain
 * module posts through, per CLAUDE.md's "posting rules live in one
 * module"), `AuditModule` for audit-log writes, `PdfModule` for the
 * invoice PDF renderer, `EmailModule` for the actual SMTP send,
 * `FilesModule` for persisting the PDF generated at send time, and
 * `OrgModule` for `SettingsService` (business_profile branding in the
 * email — `InvoiceEmailWorker` needs it directly, not just transitively
 * via `PdfModule`, since Nest resolves each module's own declared
 * providers/imports independently).
 */
@Module({
  imports: [AuditModule, NumberingModule, LedgerModule, PdfModule, EmailModule, FilesModule, OrgModule, TaxModule],
  controllers: [InvoicesController, InvoiceRemindersController],
  providers: [InvoicesService, InvoiceEmailWorker, InvoiceRemindersService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
