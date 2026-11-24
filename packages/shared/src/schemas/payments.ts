import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "cheque", "card", "upi", "other"]);

/** One allocation line — how much of this payment applies to a given invoice. Server-side validates the cross-row limits (payment amount, invoice balance); this schema only checks the shape and that amount is positive. */
export const paymentAllocationInputSchema = z.object({
  invoiceId: uuidSchema,
  amount: z.coerce.bigint().positive(),
});

/**
 * PRD F6 (S-06.1, S-06.2, S-06.4, S-06.5) — records a payment against a
 * contact, optionally allocating some or all of it across one or more
 * invoices in the same call. `allocations` may be empty (S-06.4 — a
 * payment with no invoice yet, held entirely as unallocated customer
 * credit) or sum to less than `amount` (a partial allocation, the
 * remainder held as credit) — never validated to sum to exactly `amount`
 * here, since both are legitimate per the PRD's own acceptance highlights.
 * The server (PaymentsService.create) still rejects allocations summing to
 * MORE than `amount`, and each allocation individually may never exceed
 * its invoice's remaining balance — both enforced at the DB level too, per
 * §6's own "not just the UI" acceptance highlight.
 */
export const createPaymentSchema = z.object({
  contactId: uuidSchema,
  date: z.coerce.date(),
  method: paymentMethodSchema,
  reference: z.string().optional().nullable(),
  currency: currencyCodeSchema,
  amount: z.coerce.bigint().positive(),
  notes: z.string().optional().nullable(),
  /** US-BANK-03 — the account the money went into; omitted means the organisation's default. */
  moneyAccountId: uuidSchema.optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).default([]),
  /** US-PAY-23 — the "Email a receipt" switch; omitted: sent when the customer has an email address, as before. */
  sendReceipt: z.boolean().optional(),
});

/**
 * S-05.5's other half — applies an EXISTING payment's sitting unallocated
 * credit (S-06.4) against one or more invoices that didn't exist yet (or
 * weren't chosen) at the time the payment was originally created. Reuses
 * `paymentAllocationInputSchema` — the shape of "how much applies to which
 * invoice" is identical to `create()`'s own `allocations`, only the target
 * (an existing payment vs. a brand-new one) differs.
 */
export const applyPaymentCreditSchema = z.object({
  allocations: z.array(paymentAllocationInputSchema).min(1),
});

/** US-PAY-26 (D-221) — `POST /payments/:id/allocations/:allocationId/unapply`: move a payment off an invoice. */
export const unapplyPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

/** US-PAY-19 — one invoice a payment was applied to, on `GET /payments/:id`. */
export interface PaymentAppliedTo {
  allocationId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceTotal: string;
  /** What the invoice still owes now, minor units. */
  invoiceBalance: string;
  invoiceType: string;
  invoiceStatus: string;
  amount: string;
  at: string;
}

export type PaymentActivityType = "recorded" | "applied" | "unapplied" | "emailed" | "refunded" | "refund_deleted";

/** US-PAY-20 — `GET /payments/:id/activity`, newest first. */
export interface PaymentActivityEntry {
  at: string;
  type: PaymentActivityType;
  actorName: string | null;
  /** Minor units: what was received, applied, moved off or refunded. */
  amount?: string | null;
  /** The invoice number (applied, unapplied), the email address (emailed) or the method (recorded, refunded). */
  detail?: string | null;
  /** The invoice (applied, unapplied) or the refund. */
  linkId?: string | null;
  /** Recorded: the money account's name. */
  account?: string | null;
  /** Unapplied: the reason given. */
  reason?: string | null;
}

/** US-PAY-24 — `GET /payments/possible-duplicates`. */
export interface PossibleDuplicatePayment {
  id: string;
  number: string | null;
  date: string;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
}

/** `POST /customer-refunds` (US-PAY-17): pay a customer back out of one source of their credit. */
export const createCustomerRefundSchema = z
  .object({
    sourcePaymentId: uuidSchema.optional().nullable(),
    sourceCreditNoteId: uuidSchema.optional().nullable(),
    amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05."),
    moneyAccountId: uuidSchema.optional().nullable(),
    method: paymentMethodSchema,
    reference: z.string().trim().max(120).optional().nullable(),
    sendConfirmation: z.boolean().optional().default(false),
  })
  .refine((v) => Boolean(v.sourcePaymentId) !== Boolean(v.sourceCreditNoteId), { message: "Choose the payment or credit note to refund from.", path: ["sourcePaymentId"] });
export type CreateCustomerRefundInput = z.infer<typeof createCustomerRefundSchema>;

export interface CustomerRefund {
  id: string;
  contactId: string;
  contactName: string;
  source: { kind: "payment" | "credit_note"; id: string; number: string | null };
  moneyAccount: { id: string; name: string };
  amount: string;
  currency: string;
  date: string;
  method: string;
  reference: string | null;
  deletedAt: string | null;
  /** Only on create: whether the "We've refunded …" email went, and why not. */
  confirmation?: { sent: boolean; reason?: string };
}
