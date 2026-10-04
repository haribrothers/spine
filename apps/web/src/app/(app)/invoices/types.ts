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
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
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
  /** Denormalized running total, kept in sync by CreditNotesService.issue (S-05.6) — never client-computed. */
  creditedAmount: string;
  notes: string | null;
  termsAndConditions: string | null;
  createdByUserId: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  journalEntryId: string | null;
  voidJournalEntryId: string | null;
  issuedPdfFileId: string | null;
  emailStatus: InvoiceEmailStatus | null;
  emailError: string | null;
  emailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed server-side at read time (S-05.9) — only an issued invoice past its due date with a balance still owing. Never stored. */
  isOverdue: boolean;
  /** US-PAY-13 — derived by the API from what's been paid against the balance. */
  paymentStatus: "unpaid" | "partially_paid" | "paid";
  /** Computed server-side — totalAmount - amountPaid - creditedAmount. */
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
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  archivedAt: string | null;
}

/** FEAT-08 — used by the line editor's tax picker. Mirrors quotes/types.ts's identical shape. */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  archivedAt: string | null;
}

export interface TaxGroupOption {
  id: string;
  name: string;
  archivedAt: string | null;
  taxRates: TaxRateOption[];
}

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  upi: "UPI",
  other: "Other",
};

/** Mirrors GET /payments?invoiceId=:id's response shape (PaymentsService.listForInvoice) — a payment row plus how much of it was allocated specifically to this invoice, since one payment can span several invoices (S-06.2). */
export interface InvoicePaymentRow {
  id: string;
  number: string | null;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  currency: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  /** This payment's allocation specifically against the invoice being viewed — not the payment's own total. */
  allocatedToThisInvoice: string;
}

export type CreditNoteStatus = "draft" | "issued";
export type CreditNoteLineType = "item" | "heading" | "text";

/** Mirrors apps/api/src/db/schema/credit-notes.ts's creditNoteLines row shape. */
export interface CreditNoteLine {
  id: string;
  creditNoteId: string;
  sortOrder: number;
  type: CreditNoteLineType;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  unitPriceCurrency: string;
  taxRatePercentage: number;
  lineSubtotalAmount: string;
  lineTaxAmount: string;
  lineTotalAmount: string;
}

/** Mirrors GET /credit-notes/:id's response shape (CreditNotesService.getOne). */
export interface CreditNote {
  id: string;
  orgId: string;
  invoiceId: string;
  contactId: string;
  number: string | null;
  status: CreditNoteStatus;
  reason: string | null;
  date: string | null;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdByUserId: string | null;
  issuedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  contactName: string | null;
  invoiceNumber: string | null;
  lines: CreditNoteLine[];
}

/** US-PAY-13 — shown next to the status badge once anything has been paid. */
export const PAYMENT_STATUS_LABELS: Record<Invoice["paymentStatus"], string | null> = {
  unpaid: null,
  partially_paid: "Partially paid",
  paid: "Paid",
};
