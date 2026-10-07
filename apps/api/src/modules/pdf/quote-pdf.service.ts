import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { quotes, quoteLines, contacts } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { FilesService } from "../files/files.service";
import { resolveDocumentBranding, resolveDocumentLayout } from "@spine/shared";
import { orgLocale } from "../../common/money-format";
import { QuotePdfDocument, type QuotePdfBusinessProfile } from "./quote-pdf.template";

/**
 * Renders a quote to a PDF `Buffer` using `@react-pdf/renderer` — pure
 * JS-to-PDF layout (no headless browser), chosen per CLAUDE.md's stack
 * table specifically for its "byte-identical across environments"
 * requirement (a Puppeteer-based renderer can drift with the host's
 * installed Chromium version; React-PDF's layout engine has no such
 * dependency).
 *
 * Deliberately reads the quote/lines/contact straight from the DB rather
 * than accepting them as parameters — both `QuotesController`'s `GET
 * /quotes/:id/pdf` route and the send-email worker job need the exact same
 * rendering given only an org id + quote id, so this is the one place that
 * logic lives.
 */
@Injectable()
export class QuotePdfService {
  private readonly logger = new Logger(QuotePdfService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: SettingsService,
    private readonly files: FilesService,
  ) {}

  async render(orgId: string, quoteId: string): Promise<{ buffer: Buffer; filename: string }> {
    const [row] = await this.db
      .select({ quote: quotes, contactName: contacts.name, contactEmail: contacts.email })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    if (!row) {
      throw new NotFoundException("Quote not found");
    }

    const lines = await this.db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId))
      .orderBy(quoteLines.sortOrder);

    const business = await this.settings.get<QuotePdfBusinessProfile>(orgId, "business_profile");

    // US-SET-10 — document colour and footer for new and draft documents; issued ones are served from the stored PDF.

    const branding = resolveDocumentBranding(await this.settings.get(orgId, "branding"));
    const logoDataUri = business?.logoUrl ? await this.tryFetchLogoAsDataUri(orgId, business.logoUrl) : undefined;

    const buffer = await renderToBuffer(
      QuotePdfDocument({
        layout: resolveDocumentLayout(await this.settings.get(orgId, "document_layout"), "quote"),
        quote: row.quote,
        lines,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        business,
        logoDataUri,
        locale: await orgLocale(this.db, orgId),
        branding,
      }),
    );

    const filename = `${row.quote.number ?? "quote-draft"}.pdf`;
    return { buffer, filename };
  }

  /**
   * `business_profile.logoUrl` is `${API_URL}/files/:id}` — a route that
   * streams the file or redirects to a presigned URL (see FilesController.get).
   * Rather than following that HTTP redirect chain (fragile inside a
   * server process, and adds a dependency on APP_URL being reachable from
   * itself), this extracts the file id from that URL and reads the object
   * through FilesService — the same storage driver, no network hop
   * through the API's own HTTP server. Returns `undefined` (never
   * throws) on any failure — object storage being unavailable must degrade
   * the PDF's header to text-only, not break PDF generation entirely,
   * matching CLAUDE.md's graceful-degradation rule for file storage.
   */
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
