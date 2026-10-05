import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { payments, paymentAllocations, invoices, contacts } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { FilesService } from "../files/files.service";
import { resolveDocumentBranding } from "@spine/shared";
import { orgLocale } from "../../common/money-format";
import { PaymentPdfDocument, type PaymentPdfBusinessProfile } from "./payment-pdf.template";

/**
 * S-06.6 — renders a payment receipt to a PDF `Buffer`. Exact structural
 * mirror of InvoicePdfService (same `@react-pdf/renderer` choice, same
 * "read straight from the DB, one code path for every caller" design, same
 * logo-as-data-URI fetch with graceful degradation). See that service's
 * own doc comment for the full reasoning; not repeated here.
 */
@Injectable()
export class PaymentPdfService {
  private readonly logger = new Logger(PaymentPdfService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  async render(orgId: string, paymentId: string): Promise<{ buffer: Buffer; filename: string }> {
    const [row] = await this.db
      .select({ payment: payments, contactName: contacts.name, contactEmail: contacts.email })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, orgId), eq(payments.id, paymentId)));
    if (!row) {
      throw new NotFoundException("Payment not found");
    }

    const allocationRows = await this.db
      .select({ allocation: paymentAllocations, invoiceNumber: invoices.number })
      .from(paymentAllocations)
      .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
      .where(eq(paymentAllocations.paymentId, paymentId));

    const business = await this.settings.get<PaymentPdfBusinessProfile>(orgId, "business_profile");

    // US-SET-10 — document colour and footer for new and draft documents; issued ones are served from the stored PDF.

    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    const buffer = await renderToBuffer(
      PaymentPdfDocument({
        payment: row.payment,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        allocations: allocationRows,
        business,
        logoDataUri,
        locale: await orgLocale(this.db, orgId),
        branding,
      }),
    );

    const filename = `${row.payment.number ?? "receipt-draft"}.pdf`;
    return { buffer, filename };
  }

  private async tryFetchLogoAsDataUri(orgId: string, logoUrl: string): Promise<string | undefined> {
    try {
      const match = logoUrl.match(/\/files\/([0-9a-fA-F-]{36})/);
      const fileId = match?.[1];
      if (!fileId) return undefined;

      const { bytes, mimeType } = await this.files.readBytes(orgId, fileId);
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    } catch (err) {
      this.logger.warn(`Could not fetch org logo for PDF, continuing without it: ${(err as Error).message}`);
      return undefined;
    }
  }
}
