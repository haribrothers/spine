import type { VendorCreditStatus } from "@spine/shared";
import type { VendorBillLine } from "../vendor-bills/types";

/** `GET /vendor-credits/:id` (US-PUR-24). Amounts are minor units as strings. */
export interface VendorCredit {
  id: string;
  number: string | null;
  vendorReference: string | null;
  contactId: string;
  contactName: string | null;
  billId: string | null;
  billNumber?: string | null;
  jobId: string | null;
  date: string;
  status: VendorCreditStatus;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  balanceAmount: string;
  notes: string | null;
  voidReason: string | null;
  createdByUserId: string | null;
  lines?: (Omit<VendorBillLine, "billId"> & { vendorCreditId: string })[];
  /** US-PUR-25 — where the credit has been used. */
  allocations?: { id: string; billId: string; billNumber: string; amount: string; createdAt: string }[];
  /** US-PUR-26 — money the vendor paid back. */
  refunds?: { id: string; amount: string; date: string; method: string; reference: string | null; deletedAt: string | null; moneyAccountName: string }[];
}
