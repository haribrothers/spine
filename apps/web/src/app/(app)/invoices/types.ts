import type { SupplyClass } from "@spine/shared";
/** Mirrors apps/api/src/db/schema/invoices.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following quotes/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `formatMoney` (lib/money.ts). */
export type InvoiceStatus = "draft" | "issued" | "void";
/** `opening` (US-RPT-17): brought in from the old system — its old number, no lines, no PDF. */
export type InvoiceType = "standard" | "advance" | "progress" | "retention_release" | "opening";
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
  supplyClass: SupplyClass | null;
  hsnSac: string | null;
  lineSubtotalAmount: string;
  lineTaxAmount: string;
  lineTotalAmount: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  contactId: string;
  /** US-TAX-13 — GST place of supply and the supply type it gave. */
  placeOfSupply: string | null;
  supplyType: "intra" | "inter" | "export" | null;
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
  /** Computed server-side — totalAmount - retentionAmount - amountPaid - creditedAmount. */
  balanceDue: string;
  /** US-INV-23 — on the list: whether a reminder (manual or automatic) already went out today, organisation time. */
  remindedToday?: boolean;
  /** US-INV-28 — on the list: the item lines' names, for search. */
  lineNames?: string[];
  /** US-INV-29 — the last payment's date ("2026-10-02"), for "Paid 2 Oct". */
  lastPaidAt?: string | null;
  /** US-INV-37 — what's left to credit (total less issued credit notes); on the list. */
  leftToCredit?: string;
  /** US-INV-30 — "From QUO-0031"; on the detail response. */
  sourceQuoteNumber?: string | null;
  /** US-JOB-21 — present on the detail response for an invoice raised from a job. */
  job?: { id: string; name: string; number?: string | null } | null;
  /** US-JOB-29 — "Progress claim 3" on an issued progress invoice; null on drafts and other types. */
  progressClaimNo?: number | null;
  milestone?: { id: string; name: string; percent: number | null } | null;
  /** Retention as a percentage of the net amount ("10"), and retention held on the whole job so far. */
  retention?: { percent: string; heldOnJob: string } | null;
  lines?: InvoiceLine[];
  /** US-INV-31 — the tax by named rate (CGST and SGST, or IGST), on the detail response. */
  taxLines?: { label: string; amount: string }[];
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
  /** US-TAX-13 — the inter-state counterpart of the default tax. */
  interTaxRateId?: string | null;
  interTaxGroupId?: string | null;
  hsnSac?: string | null;
  supplyClass: SupplyClass;
  archivedAt: string | null;
}

/** FEAT-08 — used by the line editor's tax picker. Mirrors quotes/types.ts's identical shape. */
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  isCompound: boolean;
  /** D-182 — what a 0% rate means for its lines. */
  supplyClass?: SupplyClass | null;
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
  /** US-PAY-26: the allocation of this payment to this invoice. */
  allocationId: string;
  allocatedAt: string;
  contactName: string | null;
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
  /** US-INV-36 — the invoice line it credits, and that line's rate or group. */
  invoiceLineId?: string | null;
  taxRateId?: string | null;
  taxGroupId?: string | null;
  supplyClass?: SupplyClass | null;
  hsnSac?: string | null;
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
  /** US-PAY-16 (D-142) — the excess over the invoice's balance still held as customer credit. */
  creditRemainingAmount?: string;
  createdByUserId: string | null;
  issuedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  contactName: string | null;
  invoiceNumber: string | null;
  placeOfSupply?: string | null;
  supplyType?: "intra" | "inter" | "export" | null;
  /** US-INV-38, US-INV-40 (D-219) — where its money went. */
  offInvoiceAmount: string;
  appliedAmount: string;
  refundedAmount: string;
  lastEmailedAt: string | null;
  lineNames?: string[];
  taxLines?: { label: string; amount: string }[];
  allocations?: { invoiceId: string; invoiceNumber: string | null; amount: string; at: string }[];
  lines: CreditNoteLine[];
}

/** US-INV-36 — `GET /credit-notes/creditable?invoiceId=`: an invoice's item lines and what's left to credit on each. */
export interface CreditableLine {
  invoiceLineId: string;
  position: number;
  name: string;
  description: string | null;
  quantity: number;
  creditedQuantity: number;
  leftQuantity: number;
  unitPriceAmount: string;
  taxRatePercentage: number;
  hsnSac: string | null;
  lineTotalAmount: string;
  leftAmount: string;
}
export interface Creditable {
  invoiceId: string;
  invoiceNumber: string | null;
  currency: string;
  balanceDue: string;
  leftToCredit: string;
  lines: CreditableLine[];
}
/** `POST /credit-notes/preview`. */
export interface CreditNotePreview {
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  taxLines: { label: string; amount: string }[];
  owedPart: string;
  creditPart: string;
  lines: { invoiceLineId: string | null; lineSubtotalAmount: string; lineTaxAmount: string; lineTotalAmount: string }[];
}

/** US-PAY-13 — shown next to the status badge once anything has been paid. */
export const PAYMENT_STATUS_LABELS: Record<Invoice["paymentStatus"], string | null> = {
  unpaid: null,
  partially_paid: "Partially paid",
  paid: "Paid",
};
