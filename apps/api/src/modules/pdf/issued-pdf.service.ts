import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { creditNotes, invoices, payments, quotes } from "../../db/schema";
import { FilesService } from "../files/files.service";
import { QueueService } from "../queue/queue.service";
import { CreditNotePdfService } from "./credit-note-pdf.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { PaymentPdfService } from "./payment-pdf.service";
import { QuotePdfService } from "./quote-pdf.service";

export const STORE_ISSUED_PDF_QUEUE = "store-issued-pdf";

export type IssuedDocumentKind = "quote" | "invoice" | "credit_note" | "payment";

export interface StoreIssuedPdfJobData {
  orgId: string;
  kind: IssuedDocumentKind;
  id: string;
}

export interface DocumentPdf {
  buffer: Buffer;
  filename: string;
}

/** Retried with backoff for about a day: storage being down at issue time must not lose the PDF. */
const STORE_RETRY = { retryLimit: 30, retryDelay: 30, retryDelayMax: 3600 };

/**
 * Queues storing a document's issued PDF — called by the issuing services
 * right after their transaction commits. Never throws: the document is
 * already issued, and its first download or email stores the PDF anyway.
 */
export async function queueIssuedPdf(queue: QueueService, orgId: string, kind: IssuedDocumentKind, id: string): Promise<void> {
  try {
    await queue.send(STORE_ISSUED_PDF_QUEUE, { orgId, kind, id } satisfies StoreIssuedPdfJobData, STORE_RETRY);
  } catch (err) {
    new Logger("IssuedPdf").error(`Could not queue storing the PDF of ${kind} ${id}: ${(err as Error).message}`);
  }
}

const TABLES = { quote: quotes, invoice: invoices, credit_note: creditNotes, payment: payments } as const;

/**
 * US-INV-17 (D-083) — a sent quote, or an issued invoice, credit note or
 * receipt, keeps the PDF rendered the moment it was issued. Later changes
 * to the customer's address, the logo, branding or the templates never
 * change what's downloaded or emailed: every request after the first
 * serves the stored file, byte for byte. Drafts always render live and
 * store nothing.
 *
 * The services that issue documents call `queueStore` after their
 * transaction commits; the job renders and stores the PDF, retrying while
 * storage is down. A document issued before this existed (or whose job
 * hasn't run yet) is rendered and stored on its first download or email.
 */
@Injectable()
export class IssuedPdfService implements OnModuleInit {
  private readonly logger = new Logger(IssuedPdfService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly queue: QueueService,
    private readonly files: FilesService,
    private readonly quotePdf: QuotePdfService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly creditNotePdf: CreditNotePdfService,
    private readonly paymentPdf: PaymentPdfService,
  ) {}

  async onModuleInit() {
    await this.queue.work<StoreIssuedPdfJobData>(STORE_ISSUED_PDF_QUEUE, async (job) => {
      const { orgId, kind, id } = job.data;
      await this.getOrStore(orgId, kind, id);
    });
  }

  queueStore(orgId: string, kind: IssuedDocumentKind, id: string): Promise<void> {
    return queueIssuedPdf(this.queue, orgId, kind, id);
  }

  /**
   * The PDF to serve for a document: the stored file once it's issued
   * (storing it first if it isn't yet), or a live render for a draft.
   */
  async forDownload(orgId: string, kind: IssuedDocumentKind, id: string): Promise<DocumentPdf> {
    await this.refuseOpeningInvoice(orgId, kind, id);
    return (await this.getOrStore(orgId, kind, id)) ?? this.render(orgId, kind, id);
  }

  /**
   * The PDF to attach to an email. Normally the stored file; if storage is
   * unavailable the email still goes, with a fresh render of the same
   * snapshot, and the queued job stores the PDF once storage is back.
   */
  async forEmail(orgId: string, kind: IssuedDocumentKind, id: string): Promise<DocumentPdf> {
    try {
      return await this.forDownload(orgId, kind, id);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.warn(`Stored PDF of ${kind} ${id} unavailable, attaching a fresh render: ${(err as Error).message}`);
      await this.queueStore(orgId, kind, id);
      return this.render(orgId, kind, id);
    }
  }

  /** US-RPT-17 — an opening invoice was issued by the old system; Spine has no PDF of it. */
  private async refuseOpeningInvoice(orgId: string, kind: IssuedDocumentKind, id: string) {
    if (kind !== "invoice") return;
    const [row] = await this.db.select({ type: invoices.type }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (row?.type === "opening") throw new NotFoundException("An opening invoice has no PDF in Spine. Attach the original to the invoice instead.");
  }

  /** The stored PDF of an issued document, storing it on first use. Null for a draft. */
  async getOrStore(orgId: string, kind: IssuedDocumentKind, id: string): Promise<DocumentPdf | null> {
    const doc = await this.load(orgId, kind, id);
    if (!isIssued(kind, doc)) return null;
    const filename = `${doc.number ?? kind}.pdf`;

    if (doc.issuedPdfFileId) {
      const { bytes } = await this.files.readBytes(orgId, doc.issuedPdfFileId);
      return { buffer: bytes, filename };
    }

    const rendered = await this.render(orgId, kind, id);
    const file = await this.files.upload(orgId, {
      originalFilename: rendered.filename,
      mimeType: "application/pdf",
      buffer: rendered.buffer,
      uploadedByUserId: null,
    });
    const table = TABLES[kind];
    const claimed = await this.db
      .update(table)
      .set({ issuedPdfFileId: file.id })
      .where(and(eq(table.id, id), isNull(table.issuedPdfFileId)))
      .returning({ id: table.id });
    if (claimed.length) return rendered;

    // Another request stored it first: serve theirs so every copy is identical.
    await this.files.removeUnreferenced(orgId, file.id);
    return this.getOrStore(orgId, kind, id);
  }

  private async load(orgId: string, kind: IssuedDocumentKind, id: string): Promise<{ number: string | null; status: string; issuedPdfFileId: string | null }> {
    if (kind === "payment") {
      // A payment has no draft state: once recorded, its receipt is issued.
      const [row] = await this.db
        .select({ number: payments.number, issuedPdfFileId: payments.issuedPdfFileId })
        .from(payments)
        .where(and(eq(payments.orgId, orgId), eq(payments.id, id)));
      if (!row) throw new NotFoundException("Payment not found");
      return { ...row, status: "issued" };
    }
    const table = TABLES[kind] as typeof invoices;
    const [row] = await this.db
      .select({ number: table.number, status: table.status, issuedPdfFileId: table.issuedPdfFileId })
      .from(table)
      .where(and(eq(table.orgId, orgId), eq(table.id, id)));
    if (!row) throw new NotFoundException("Document not found");
    return row;
  }

  private render(orgId: string, kind: IssuedDocumentKind, id: string): Promise<DocumentPdf> {
    switch (kind) {
      case "quote":
        return this.quotePdf.render(orgId, id);
      case "invoice":
        return this.invoicePdf.render(orgId, id);
      case "credit_note":
        return this.creditNotePdf.render(orgId, id);
      case "payment":
        return this.paymentPdf.render(orgId, id);
    }
  }
}

/** Quotes count from `sent`, invoices and credit notes from `issued` (a voided invoice keeps its PDF). */
function isIssued(_kind: IssuedDocumentKind, doc: { status: string }): boolean {
  return doc.status !== "draft";
}
