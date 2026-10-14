import type { Payment } from "../app/(app)/payments/types";

/** A UPI payment fully applied to one invoice; override what a test needs. */
export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? "p1",
    orgId: "o1",
    contactId: "c1",
    contactName: "Halcyon Tech Parks Pvt Ltd",
    number: "RCP-0031",
    date: "2026-10-10",
    method: "upi",
    moneyAccountId: "a1",
    moneyAccountName: "HDFC Current",
    reference: "UTR 4471 2280",
    currency: "INR",
    amount: "4500000",
    allocatedAmount: "4500000",
    unallocatedAmount: "0",
    refundedAmount: "0",
    notes: null,
    createdByUserId: "u1",
    journalEntryId: null,
    createdAt: "2026-10-10T06:00:00.000Z",
    updatedAt: "2026-10-10T06:00:00.000Z",
    appliedTo: [{ invoiceId: "i39", number: "INV-0039" }],
    ...overrides,
  };
}
