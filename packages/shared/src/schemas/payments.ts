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
  allocations: z.array(paymentAllocationInputSchema).default([]),
});
