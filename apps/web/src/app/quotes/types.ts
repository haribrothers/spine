/** Mirrors apps/api/src/db/schema/quotes.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape, following contacts/catalog's own precedent. */
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";
export type QuoteLineType = "item" | "heading" | "text";

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
  createdAt: string;
  updatedAt: string;
  /** Computed server-side at read time — see QuotesService's own comment on why "expired" is never stored. */
  isExpired: boolean;
  /** True once a later version's parentQuoteId points back at this quote. */
  isSuperseded: boolean;
  supersededByQuoteId?: string | null;
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
