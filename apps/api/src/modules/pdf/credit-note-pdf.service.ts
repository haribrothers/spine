import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, creditNoteLines, creditNotes, invoices } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { FilesService } from "../files/files.service";
import { loadSignatureDataUri } from "./signature";
import { CreditNotePdfDocument } from "./credit-note-pdf.template";
import { resolveDocumentBranding, resolveDocumentLayout, type DocumentLayout } from "@spine/shared";
import { orgLocale } from "../../common/money-format";
import type { InvoicePdfBusinessProfile } from "./invoice-pdf.template";

/** US-INV-17 (D-116) — renders a credit note to a PDF, the same way InvoicePdfService renders an invoice. */
@Injectable()
export class CreditNotePdfService {
  private readonly logger = new Logger(CreditNotePdfService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  async render(orgId: string, creditNoteId: string): Promise<{ buffer: Buffer; filename: string }> {
    const [row] = await this.db
      .select({ creditNote: creditNotes, invoiceNumber: invoices.number, contactName: contacts.name, contactEmail: contacts.email })
      .from(creditNotes)
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, creditNoteId)));
    if (!row) {
      throw new NotFoundException("Credit note not found");
    }

    const lines = await this.db
      .select()
      .from(creditNoteLines)
      .where(eq(creditNoteLines.creditNoteId, creditNoteId))
      .orderBy(creditNoteLines.sortOrder);

    const business = await this.settings.get<InvoicePdfBusinessProfile>(orgId, "business_profile");

    // US-SET-10 — document colour and footer for new and draft documents; issued ones are served from the stored PDF.

    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    // US-SET-17–US-SET-19: Settings › Documents.
    const savedLayout = await this.settings.get<DocumentLayout>(orgId, "document_layout");
    const layout = resolveDocumentLayout(savedLayout, "credit_note");
    const buffer = await renderToBuffer(
      CreditNotePdfDocument({
        layout,
        signatureDataUri: await loadSignatureDataUri(this.files, orgId, savedLayout, layout),
        creditNote: row.creditNote,
        lines,
        invoiceNumber: row.invoiceNumber,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        business,
        logoDataUri,
        locale: await orgLocale(this.db, orgId),
        branding,
      }),
    );
    return { buffer, filename: `${row.creditNote.number ?? "credit-note-draft"}.pdf` };
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
