import { z } from "zod";
import { uuidSchema } from "./common.ts";

/**
 * D-152 — `settings.document_layout`: what each customer document prints
 * (US-SET-17–US-SET-19). One layout, no template editor. Issued PDFs are
 * stored (D-083), so a change only affects documents issued afterwards
 * and drafts.
 */
export const DOCUMENT_TYPES = ["quote", "invoice", "credit_note", "receipt", "statement"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  quote: "Quotes",
  invoice: "Invoices",
  credit_note: "Credit notes",
  receipt: "Receipts",
  statement: "Statements",
};

/** Document types whose PDFs have a table of lines, so the column options apply. */
export const LINE_DOCUMENT_TYPES: readonly DocumentType[] = ["quote", "invoice", "credit_note"];

export const PAPER_SIZES = ["A4", "LETTER"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];
export const PAPER_SIZE_LABELS: Record<PaperSize, string> = { A4: "A4", LETTER: "Letter" };

export const DOCUMENT_TEXT_MAX = 2000;
export const DOCUMENT_TERMS_TOO_LONG = "Keep terms under 2,000 characters.";
export const DOCUMENT_NOTES_TOO_LONG = "Keep notes under 2,000 characters.";

export const documentColumnsSchema = z.object({
  /** "Quantity and unit": the quantity and unit price columns. */
  quantity: z.boolean(),
  discount: z.boolean(),
  /** Only when GST is on. */
  hsnSac: z.boolean(),
  /** "Tax per line". */
  lineTax: z.boolean(),
}).strict();
export type DocumentColumns = z.infer<typeof documentColumnsSchema>;

export const documentTypeLayoutSchema = z.object({
  paperSize: z.enum(PAPER_SIZES).optional(),
  columns: documentColumnsSchema.partial().optional(),
  /** US-SET-18 — "Quotation", "Tax Invoice", "Estimate"… */
  title: z.string().trim().max(60, "Keep the title under 60 characters.").optional(),
  /** US-SET-18 — new drafts start with these; credit notes, receipts and statements print them. */
  terms: z.string().max(DOCUMENT_TEXT_MAX, DOCUMENT_TERMS_TOO_LONG).optional(),
  notes: z.string().max(DOCUMENT_TEXT_MAX, DOCUMENT_NOTES_TOO_LONG).optional(),
  /** US-SET-19 — the signature above "Authorised signatory — <business>". */
  signature: z.boolean().optional(),
  /** US-SET-19 — the total in words, in the organisation's currency. */
  amountInWords: z.boolean().optional(),
  /** "Tax summary table" — by HSN/SAC with GST (US-TAX-15), else by rate. */
  taxSummary: z.boolean().optional(),
}).strict();
export type DocumentTypeLayout = z.infer<typeof documentTypeLayoutSchema>;

export const documentLayoutSchema = z
  .object({
    quote: documentTypeLayoutSchema.optional(),
    invoice: documentTypeLayoutSchema.optional(),
    credit_note: documentTypeLayoutSchema.optional(),
    receipt: documentTypeLayoutSchema.optional(),
    statement: documentTypeLayoutSchema.optional(),
    /** US-SET-19 — the uploaded signature image (PNG or JPEG), shared by every document type that shows it. */
    signatureFileId: uuidSchema.nullable().optional(),
  })
  .strict();
export type DocumentLayout = z.infer<typeof documentLayoutSchema>;

/** A document type's layout with every option filled in. */
export interface ResolvedDocumentLayout {
  paperSize: PaperSize;
  columns: DocumentColumns;
  title: string;
  terms: string;
  notes: string;
  signature: boolean;
  amountInWords: boolean;
  taxSummary: boolean;
}

const DEFAULT_TITLES: Record<DocumentType, string> = {
  quote: "Quote",
  invoice: "Invoice",
  credit_note: "Credit note",
  receipt: "Receipt",
  statement: "Statement",
};

/** The layout a document type prints with: what's saved, else the defaults (everything shown, A4, no extras). */
export function resolveDocumentLayout(layout: DocumentLayout | null | undefined, type: DocumentType): ResolvedDocumentLayout {
  const saved = layout?.[type] ?? {};
  return {
    paperSize: saved.paperSize ?? "A4",
    columns: { quantity: true, discount: true, hsnSac: true, lineTax: true, ...saved.columns },
    title: saved.title?.trim() || DEFAULT_TITLES[type],
    terms: saved.terms ?? "",
    notes: saved.notes ?? "",
    signature: saved.signature ?? false,
    amountInWords: saved.amountInWords ?? false,
    taxSummary: saved.taxSummary ?? false,
  };
}
