import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { QuotePdfService } from "./quote-pdf.service";
import { InvoicePdfService } from "./invoice-pdf.service";

/**
 * PRD F3 Stage 2 (S-03.3) / F5 Stage 1 (S-05.7 PDF half) — quote and
 * invoice PDF rendering via `@react-pdf/renderer`. Imports `OrgModule` for
 * `SettingsService` (business_profile branding). No controller of its own
 * — `QuotesController`/`InvoicesController` each expose their own
 * `GET :id/pdf` directly, matching each module's existing REST surface
 * rather than this module owning a competing `/pdf` route namespace.
 */
@Module({
  imports: [OrgModule],
  providers: [QuotePdfService, InvoicePdfService],
  exports: [QuotePdfService, InvoicePdfService],
})
export class PdfModule {}
