import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BankingModule } from "../banking/banking.module";
import { NumberingModule } from "../numbering/numbering.module";
import { LedgerModule } from "../ledger/ledger.module";
import { EmailModule } from "../email/email.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgModule } from "../org/org.module";
import { PdfModule } from "../pdf/pdf.module";
import { CustomerRefundsController } from "./customer-refunds.controller";
import { CustomerRefundsService } from "./customer-refunds.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

/**
 * PRD F6 Stage 1 (Phase 2 · Money In) — record payments against a contact,
 * allocate across invoices (S-06.1, S-06.2, S-06.4, S-06.5), oldest-first
 * allocation suggestion (S-06.3), a receipt PDF (S-06.6), and a
 * payment-confirmation email to the contact + an org notification (email +
 * in-app) on every recorded payment. The receivables/AR-aging view
 * (S-06.7) is a later stage. Imports `NumberingModule` for gapless receipt
 * numbering, `LedgerModule` for `LedgerService` (the same posting/reversal
 * primitive InvoicesModule uses), `AuditModule` for audit-log writes,
 * `EmailModule` for the customer confirmation send, `NotificationsModule`
 * for the org-facing notification, `OrgModule` for `SettingsService`
 * (business_profile branding in the confirmation email), and `PdfModule`
 * for `PaymentPdfService`.
 */
@Module({
  imports: [AuditModule, BankingModule, NumberingModule, LedgerModule, EmailModule, NotificationsModule, OrgModule, PdfModule],
  controllers: [PaymentsController, CustomerRefundsController],
  providers: [PaymentsService, CustomerRefundsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
