import type { Invoice } from "../app/(app)/invoices/types";

/** An invoice for the US-INV-27 to US-INV-35 tests. */
export const invoice = (over: Partial<Invoice>): Invoice =>
  ({
    id: over.number ?? "i",
    orgId: "o",
    contactId: "c1",
    contactName: "Sahyadri Retail Pvt Ltd",
    placeOfSupply: null,
    supplyType: null,
    number: null,
    status: "issued",
    type: "standard",
    sourceQuoteId: null,
    issueDate: "2026-09-10",
    dueDate: "2026-10-10",
    currency: "INR",
    subtotalAmount: "100000",
    discountAmount: "0",
    taxAmount: "0",
    retentionAmount: "0",
    totalAmount: "100000",
    amountPaid: "0",
    creditedAmount: "0",
    balanceDue: "100000",
    isOverdue: false,
    paymentStatus: "unpaid",
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
    lineNames: [],
    ...over,
  }) as Invoice;
