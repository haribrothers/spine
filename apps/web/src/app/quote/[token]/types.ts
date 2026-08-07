/**
 * Mirrors `PublicQuoteView` (apps/api/src/modules/quotes/public-quotes.service.ts)
 * exactly — the deliberately reduced, public-safe projection returned by
 * `GET /public/quotes/:token`. NOT the same shape as `apps/web/src/app/quotes/types.ts`'s
 * `Quote` (the authenticated, full-row shape) — this route must never import
 * that file, since reusing it would suggest this page has access to fields
 * it deliberately doesn't.
 */
export type PublicQuoteStatus = "sent" | "accepted" | "rejected";
export type PublicQuoteLineType = "item" | "heading" | "text";

export interface PublicQuoteBusinessProfile {
  name: string;
  logoUrl?: string;
  address?: string;
  industry?: string;
}

export interface PublicQuoteLine {
  id: string;
  type: PublicQuoteLineType;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: string;
  discountPercentage: number;
  taxRatePercentage: number;
  lineTotalAmount: string;
}

export interface PublicQuoteView {
  id: string;
  number: string | null;
  status: PublicQuoteStatus;
  version: number;
  validUntil: string | null;
  currency: string;
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  responseComment: string | null;
  contactName: string | null;
  business: PublicQuoteBusinessProfile | null;
  lines: PublicQuoteLine[];
}
