import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { payments, paymentAllocations, invoices, contacts, files } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { getS3Client, getS3Config } from "../files/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
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
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    const buffer = await renderToBuffer(
      PaymentPdfDocument({
        payment: row.payment,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        allocations: allocationRows,
        business,
        logoDataUri,
      }),
    );

    const filename = `${row.payment.number ?? "receipt-draft"}.pdf`;
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
