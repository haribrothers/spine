import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, invoiceLines, contacts, files } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { getS3Client, getS3Config } from "../files/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
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
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    const buffer = await renderToBuffer(
      InvoicePdfDocument({
        invoice: row.invoice,
        lines,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        business,
        logoDataUri,
      }),
    );

    const filename = `${row.invoice.number ?? "invoice-draft"}.pdf`;
    return { buffer, filename };
  }

  private async tryFetchLogoAsDataUri(orgId: string, logoUrl: string): Promise<string | undefined> {
    try {
      const client = getS3Client();
      const config = getS3Config();
      if (!client || !config) return undefined;

      const match = logoUrl.match(/\/files\/([0-9a-fA-F-]{36})/);
      const fileId = match?.[1];
      if (!fileId) return undefined;

      const [fileRow] = await this.db
        .select()
        .from(files)
        .where(and(eq(files.orgId, orgId), eq(files.id, fileId)));
      if (!fileRow) return undefined;

      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: fileRow.key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return undefined;

      const base64 = Buffer.from(bytes).toString("base64");
      return `data:${fileRow.mimeType};base64,${base64}`;
    } catch (err) {
      this.logger.warn(`Could not fetch org logo for PDF, continuing without it: ${(err as Error).message}`);
      return undefined;
    }
  }
}
