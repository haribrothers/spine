import { t } from "../../../lib/i18n";

/** Mirrors apps/api/src/db/schema/purchases.ts's `vendorPayments`/`vendorPaymentAllocations` row shapes — hand-written to match the API's JSON response, following payments/types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `formatMoney` (lib/money.ts). */
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: t("vendorPayments.methods.cash"),
  bank_transfer: t("vendorPayments.methods.bankTransfer"),
  cheque: t("vendorPayments.methods.cheque"),
  card: t("vendorPayments.methods.card"),
  upi: t("vendorPayments.methods.upi"),
  other: t("vendorPayments.methods.other"),
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
  /** US-BANK-03 — the account the money went into or came out of. */
  moneyAccountId?: string | null;
  moneyAccount?: { id: string; name: string } | null;
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
  /** US-PUR-51 — on list rows: the account's name and the bills it paid. */
  moneyAccountName?: string | null;
  paidTo?: { billId: string; number: string }[] | VendorPaymentPaidTo[];
}

/** US-PUR-49 — one bill a payment paid, on its page. */
export interface VendorPaymentPaidTo {
  allocationId: string;
  billId: string;
  billNumber: string;
  billDate: string | null;
  billTotal: string;
  billBalance: string;
  dueDate: string | null;
  amount: string;
}

/** `GET /vendor-payments/:id`. */
export interface VendorPaymentDetailData extends Omit<VendorPayment, "paidTo"> {
  paidTo: VendorPaymentPaidTo[];
  /** US-PUR-50 — matched to a bank statement line: unmatch it before deleting. */
  reconciled: boolean;
}

/** A list row. */
export interface VendorPaymentRow extends Omit<VendorPayment, "paidTo"> {
  moneyAccountName: string | null;
  paidTo: { billId: string; number: string }[];
}

/** Minimal shape used by the vendor-only contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}
