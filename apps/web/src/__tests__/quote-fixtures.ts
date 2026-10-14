import type { Quote } from "../app/(app)/quotes/types";

/** A quote for the US-QUO-27 to US-QUO-36 tests. */
export const quote = (over: Partial<Quote>): Quote =>
  ({
    id: over.number ?? over.title ?? "q",
    orgId: "o",
    contactId: "c1",
    contactName: "Ananya Rao",
    title: null,
    number: null,
    status: "draft",
    parentQuoteId: null,
    version: 1,
    validUntil: null,
    currency: "INR",
    subtotalAmount: "0",
    discountAmount: "0",
    taxAmount: "0",
    totalAmount: "100000",
    isExpired: false,
    isSuperseded: false,
    rootQuoteId: over.id ?? over.number ?? over.title ?? "q",
    sentAt: null,
    respondedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    viewCount: 0,
    lastViewedAt: null,
    lineNames: [],
    ...over,
  }) as Quote;
