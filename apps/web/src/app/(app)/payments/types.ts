/** Mirrors apps/api/src/db/schema/payments.ts's row shapes — hand-written to match the API's JSON response, following invoices/quotes' types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `toDecimalString`. */
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  upi: "UPI",
  other: "Other",
};

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: string;
  createdAt: string;
  /** Only present on GET /payments/:id — the list endpoint doesn't join invoice details per-row. */
  invoiceNumber?: string | null;
  invoiceTotal?: string | null;
}

export interface Payment {
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
  /** Computed server-side — amount - allocatedAmount. */
  unallocatedAmount: string;
  notes: string | null;
  createdByUserId: string | null;
  journalEntryId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present on GET /payments/:id, not the list endpoint. */
  allocations?: PaymentAllocation[];
}

/** Minimal shape used by the contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}
