/** Mirrors apps/api/src/db/schema/quotes.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following contacts/catalog's own precedent. */
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";
export type QuoteLineType = "item" | "heading" | "text";
export type QuoteEmailStatus = "pending" | "sent" | "failed";

export interface QuoteLine {
  id: string;
  quoteId: string;
  sortOrder: number;
  type: QuoteLineType;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  /** Minor units, serialized as a string over JSON — see MoneyInput's `value: bigint` contract; parse with `BigInt(...)`. */
  unitPriceAmount: string;
  unitPriceCurrency: string;
  discountPercentage: number;
  taxRatePercentage: number;
  lineSubtotalAmount: string;
  lineTaxAmount: string;
  lineTotalAmount: string;
}

export interface Quote {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string | null;
  number: string | null;
  status: QuoteStatus;
  parentQuoteId: string | null;
  version: number;
  validUntil: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  discountRequiresApproval: boolean;
  approvedByUserId: string | null;
  approvedAt: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  createdByUserId: string | null;
  sentAt: string | null;
  /** Set once the PDF generated at send time is persisted (Stage 2, S-03.3/S-03.4) — null on a draft, and possibly still null on a sent quote if persistence itself failed (logged server-side, not fatal). The "Download PDF" affordance doesn't need this directly — `GET /quotes/:id/pdf` renders live regardless — but it's useful to know a durable copy exists. */
  pdfFileId: string | null;
  /** null until QuotesService.send() sets it to "pending" right before enqueuing the email job; the worker (quote-email.worker.ts) owns every transition after that. See quotes.ts's schema comment for why "failed" can appear mid-retry, not only after retries are exhausted. */
  emailStatus: QuoteEmailStatus | null;
  /** Set only when emailStatus is "failed" — the most recent attempt's error message. */
  emailError: string | null;
  /** Set once the worker's SMTP send call actually succeeds — may lag sentAt (which marks when the quote was issued) by however long the queue took to process the job. */
  emailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed server-side at read time — see QuotesService's own comment on why "expired" is never stored. */
  isExpired: boolean;
  /** True once a later version's parentQuoteId points back at this quote. */
  isSuperseded: boolean;
  supersededByQuoteId?: string | null;
  /** The version-1 ancestor's id, walked server-side from parentQuoteId — every version of "the same quote" shares this value, used by quotes-table.tsx to group rows (item 4, user feedback). */
  rootQuoteId: string;
  lines?: QuoteLine[];
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
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

/** Mirrors QuotesService.enrichEmailQueueJobs's response shape (GET /quotes/email-queue) — item 7, user feedback. */
export interface QuoteEmailQueueJob {
  jobId: string;
  quoteId: string;
  quoteNumber: string | null;
  contactName: string | null;
  state: string;
  retryCount: number;
  retryLimit: number;
  createdOn: string;
  startAfter: string;
}
