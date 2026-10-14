import type { CreditNoteRow } from "../app/(app)/credit-notes/types";

/** A credit note row for the US-INV-36 to US-INV-41 tests. */
export const creditNote = (over: Partial<CreditNoteRow>): CreditNoteRow =>
  ({
    id: over.number ?? "c",
    orgId: "o",
    invoiceId: "i1",
    contactId: "c1",
    number: null,
    status: "issued",
    reason: null,
    date: "2026-10-06",
    currency: "INR",
    subtotalAmount: "5040000",
    taxAmount: "907200",
    totalAmount: "5947200",
    createdByUserId: null,
    issuedAt: "2026-10-06T05:30:00Z",
    isDemo: false,
    createdAt: "2026-10-06T05:30:00Z",
    updatedAt: "2026-10-06T05:30:00Z",
    contactName: "Sahyadri Retail Pvt Ltd",
    invoiceNumber: "INV-0041",
    creditRemainingAmount: "0",
    offInvoiceAmount: "5947200",
    appliedAmount: "0",
    refundedAmount: "0",
    lastEmailedAt: null,
    lineNames: [],
    ...over,
  }) as CreditNoteRow;
