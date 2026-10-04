import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { OrgModule } from "../org/org.module";
import { QuotePdfService } from "./quote-pdf.service";
import { CreditNotePdfService } from "./credit-note-pdf.service";
import { IssuedPdfService } from "./issued-pdf.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { PaymentPdfService } from "./payment-pdf.service";

/**
 * PRD F3 Stage 2 (S-03.3) / F5 Stage 1 (S-05.7 PDF half) / F6 (S-06.6) —
 * quote, invoice, and payment-receipt PDF rendering via
 * `@react-pdf/renderer`. Imports `OrgModule` for `SettingsService`
 * (business_profile branding) and `FilesModule` for the logo. No controller of its own —
 * `QuotesController`/`InvoicesController`/`PaymentsController` each expose
 * their own `GET :id/pdf` directly, matching each module's existing REST
 * surface rather than this module owning a competing `/pdf` route
 * namespace.
 */
@Module({
  imports: [OrgModule, FilesModule],
  providers: [QuotePdfService, InvoicePdfService, PaymentPdfService, CreditNotePdfService, IssuedPdfService],
  exports: [QuotePdfService, InvoicePdfService, PaymentPdfService, CreditNotePdfService, IssuedPdfService],
})
export class PdfModule {}
