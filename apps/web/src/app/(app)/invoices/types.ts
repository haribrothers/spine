/** Mirrors apps/api/src/db/schema/invoices.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following quotes/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `toDecimalString`. */
export type InvoiceStatus = "draft" | "issued" | "void";
export type InvoiceType = "standard" | "advance" | "progress";
export type InvoiceLineType = "item" | "heading" | "text";
/** Mirrors quotes' own QuoteEmailStatus — null until `sendEmail()` is called (S-05.7), then "pending" immediately, flipped to "sent"/"failed" by the queue worker. */
export type InvoiceEmailStatus = "pending" | "sent" | "failed";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  sortOrder: number;
  type: InvoiceLineType;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  discountPercentage: number;
  taxRatePercentage: number;
  lineSubtotalAmount: string;
  lineTaxAmount: string;
  lineTotalAmount: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string | null;
  number: string | null;
  status: InvoiceStatus;
  type: InvoiceType;
  sourceQuoteId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  retentionAmount: string;
  totalAmount: string;
  /** Denormalized running total, kept in sync by PaymentsService on every allocation — never client-computed. */
  amountPaid: string;
  notes: string | null;
  termsAndConditions: string | null;
  createdByUserId: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  journalEntryId: string | null;
  voidJournalEntryId: string | null;
  pdfFileId: string | null;
  emailStatus: InvoiceEmailStatus | null;
  emailError: string | null;
  emailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed server-side at read time (S-05.9) — only an issued invoice past its due date with a balance still owing. Never stored. */
  isOverdue: boolean;
  /** Computed server-side — totalAmount - amountPaid. */
  balanceDue: string;
  lines?: InvoiceLine[];
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  void: "Void",
};

/** Minimal shape used by the contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}

/** Minimal shape used by the catalog-item picker in the line editor. */
export interface CatalogItemOption {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPriceAmount: string;
  defaultPriceCurrency: string;
  defaultTaxRatePercentage: number;
  archivedAt: string | null;
}
