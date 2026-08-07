import { Module } from "@nestjs/common";
import { OrgModule } from "../org/org.module";
import { QuotePdfService } from "./quote-pdf.service";

/**
 * PRD F3 Stage 2 (S-03.3) — quote PDF rendering via `@react-pdf/renderer`.
 * Imports `OrgModule` for `SettingsService` (business_profile branding).
 * No controller of its own — `QuotesController` exposes `GET
 * /quotes/:id/pdf` directly (matching that module's existing REST surface)
 * rather than this module owning a competing `/pdf` route namespace.
 */
@Module({
  imports: [OrgModule],
  providers: [QuotePdfService],
  exports: [QuotePdfService],
})
export class PdfModule {}
