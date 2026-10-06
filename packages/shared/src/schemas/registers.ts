import { z } from "zod";

/**
 * US-RPT-30, US-RPT-31 — registers of money received and paid, and of
 * credits and refunds, for a date range.
 */
export const paymentRegisterQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
    moneyAccountId: z.string().uuid("Choose one of your money accounts.").optional(),
  })
  .refine((q) => q.from <= q.to, "Choose a From date on or before the To date.");

export interface RegisterAllocation {
  documentId: string;
  number: string | null;
  /** Minor units. */
  amount: string;
  /** An invoice or bill from before the cutover (Opening balances). */
  opening: boolean;
  href: string;
}

export interface PaymentRegisterRow {
  id: string;
  number: string | null;
  date: string;
  contact: { id: string; name: string };
  method: string;
  moneyAccount: { id: string; name: string } | null;
  /** Minor units. */
  amount: string;
  allocations: RegisterAllocation[];
  /** Received but not applied to an invoice (or paid but not applied to a bill), less refunds. */
  heldAsCredit: string;
  refunded: string;
  href: string;
}

export interface PaymentRegisterReport {
  from: string;
  to: string;
  rows: PaymentRegisterRow[];
  totals: { count: number; amount: string; heldAsCredit: string; heldCount: number };
}

export const creditRegisterQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
  })
  .refine((q) => q.from <= q.to, "Choose a From date on or before the To date.");

export interface CreditRegisterRow {
  id: string;
  /** Spine's number (CRN-…, VCR-…). */
  number: string | null;
  /** The vendor's own credit note number, for vendor credits. */
  reference: string | null;
  date: string;
  contact: { id: string; name: string };
  /** The invoice credited, or the bill a vendor credit was raised against. */
  against: { id: string; number: string | null; href: string } | null;
  /** Minor units. */
  total: string;
  applied: string;
  refunded: string;
  /** Still held as credit. */
  held: string;
  appliedTo: RegisterAllocation[];
  href: string;
}

export interface CreditRegisterReport {
  from: string;
  to: string;
  rows: CreditRegisterRow[];
  totals: { count: number; total: string; applied: string; refunded: string; held: string };
}
