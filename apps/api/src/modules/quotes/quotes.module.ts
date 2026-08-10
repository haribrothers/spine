import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { NumberingModule } from "../numbering/numbering.module";
import { OrgModule } from "../org/org.module";
import { FilesModule } from "../files/files.module";
import { PdfModule } from "../pdf/pdf.module";
import { EmailModule } from "../email/email.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TaxModule } from "../tax/tax.module";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { QuoteEmailWorker } from "./quote-email.worker";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { PublicQuotesController } from "./public-quotes.controller";
import { PublicQuotesService } from "./public-quotes.service";

/**
 * PRD F3 — quote CRUD, line items, versioning, discount approval (Stage 1:
 * S-03.1, S-03.2, S-03.8, S-03.9, S-03.11), PDF rendering and email sending
 * (Stage 2: S-03.3, S-03.4), and the public accept/reject link plus owner
 * notifications (Stage 3: S-03.5, S-03.6, S-03.7 — F3 is now fully
 * complete except S-03.10/S-03.12, both correctly deferred to later
 * phases). Imports `NumberingModule` for gapless number allocation on
 * send, `AuditModule` for audit-log writes on every mutation (including
 * the public accept/reject action), `OrgModule` for `SettingsService`
 * (discount-approval threshold + business_profile branding), `PdfModule`
 * for the quote PDF renderer, `FilesModule` for persisting the PDF
 * generated at send time, `EmailModule` for the actual SMTP send, and
 * `NotificationsModule` for `NotificationsService` (owner-notification
 * emails on view/accept, S-03.7). `QuoteEmailWorker` is a provider (not
 * exported — it self-registers with pg-boss via its own `onModuleInit`)
 * rather than a controller, since it's a queue consumer, not an HTTP
 * endpoint. `PublicQuotesController` is registered alongside
 * `QuotesController` but is a wholly separate, unauthenticated route group
 * (`/public/quotes/*`) — see its own doc comment.
 */
@Module({
  imports: [AuditModule, NumberingModule, OrgModule, FilesModule, PdfModule, EmailModule, NotificationsModule, TaxModule],
  controllers: [QuotesController, PublicQuotesController],
  providers: [QuotesService, QuoteEmailWorker, QuotePublicTokenService, PublicQuotesService],
  exports: [QuotesService, QuotePublicTokenService],
})
export class QuotesModule {}
