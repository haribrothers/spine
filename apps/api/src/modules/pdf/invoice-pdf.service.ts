import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, invoiceLines, contacts } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { FilesService } from "../files/files.service";
import { resolveDocumentBranding } from "@spine/shared";
import { orgLocale } from "../../common/money-format";
import { InvoicePdfDocument, type InvoicePdfBusinessProfile } from "./invoice-pdf.template";

/**
 * Renders an invoice to a PDF `Buffer` — exact structural mirror of
 * QuotePdfService (same `@react-pdf/renderer` choice, same "read straight
 * from the DB, one code path for every caller" design, same logo-as-
 * data-URI fetch with graceful degradation). See that service's own doc
 * comment for the full reasoning; not repeated here.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  async render(orgId: string, invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const [row] = await this.db
      .select({ invoice: invoices, contactName: contacts.name, contactEmail: contacts.email })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
    if (!row) {
      throw new NotFoundException("Invoice not found");
    }

    const lines = await this.db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(invoiceLines.sortOrder);

    const business = await this.settings.get<InvoicePdfBusinessProfile>(orgId, "business_profile");

    // US-SET-10 — document colour and footer for new and draft documents; issued ones are served from the stored PDF.

    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    const buffer = await renderToBuffer(
      InvoicePdfDocument({
        invoice: row.invoice,
        lines,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        business,
        logoDataUri,
        locale: await orgLocale(this.db, orgId),
        branding,
      }),
    );

    const filename = `${row.invoice.number ?? "invoice-draft"}.pdf`;
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
