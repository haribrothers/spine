import type { PaymentAppliedTo } from "@spine/shared";
import { t } from "../../../lib/i18n";

/** Mirrors apps/api/src/db/schema/payments.ts's row shapes — hand-written to match the API's JSON response, following invoices/quotes' types.ts's own precedent. Every bigint money field is serialized as a string over JSON; parse with `BigInt(...)`, format with `formatMoney` (lib/money.ts). */
export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: t("payments.method.cash"),
  bank_transfer: t("payments.method.bankTransfer"),
  cheque: t("payments.method.cheque"),
  card: t("payments.method.card"),
  upi: t("payments.method.upi"),
  other: t("payments.method.other"),
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
  /** US-BANK-03 — the account the money went into or came out of. */
  moneyAccountId?: string | null;
  moneyAccount?: { id: string; name: string } | null;
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
  /** US-PAY-17 — paid back out of this payment's credit. */
  refundedAmount?: string;
  /** US-PAY-21 — on the list: the invoices it was applied to, and the account's name. */
  moneyAccountName?: string | null;
  /** On the list `{ invoiceId, number }`; on GET /payments/:id the full `PaymentAppliedTo` (US-PAY-19). */
  appliedTo?: { invoiceId: string; number?: string | null }[];
}

/** `GET /payments/:id` (US-PAY-19). */
export interface PaymentDetailData extends Payment {
  appliedTo: PaymentAppliedTo[];
}

/** Minimal shape used by the contact picker — a subset of apps/web/src/app/contacts/types.ts's `Contact`. */
export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}
