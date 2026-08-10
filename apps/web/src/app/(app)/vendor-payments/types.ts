/** Mirrors apps/api/src/db/schema/purchases.ts's `vendorPayments`/`vendorPaymentAllocations` row shapes — hand-written to match the API's JSON response, following payments/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `toDecimalString`. */
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  upi: "UPI",
  other: "Other",
};

export interface VendorPaymentAllocation {
  id: string;
  vendorPaymentId: string;
  billId: string;
  amount: string;
  createdAt: string;
  /** Only present on GET /vendor-payments/:id — the list endpoint doesn't join bill details per-row. */
  billNumber?: string | null;
  billTotal?: string | null;
}

export interface VendorPayment {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string | null;
  number: string | null;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  currency: string;
  amount: string;
  allocatedAmount: string;
  notes: string | null;
  createdByUserId: string | null;
  journalEntryId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present on GET /vendor-payments/:id, not the list endpoint. */
  allocations?: VendorPaymentAllocation[];
}

/** Minimal shape used by the vendor-only contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}
