import { z } from "zod";
import { currencyCodeSchema, hsnSacSchema, placeOfSupplySchema, uuidSchema } from "./common.ts";
import { SUPPLY_CLASSES } from "../tax/supply-class.ts";

export const creditNoteLineTypeSchema = z.enum(["item", "heading", "text"]);

/** Structurally identical to invoiceLineInputSchema minus discountPercentage — a credit note corrects an already-net amount, it doesn't re-apply a discount. */
export const creditNoteLineInputSchema = z.object({
  id: uuidSchema.optional(),
  type: creditNoteLineTypeSchema.default("item"),
  catalogItemId: uuidSchema.optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0).default(0),
  unitPriceAmount: z.coerce.bigint().default(0n),
  unitPriceCurrency: currencyCodeSchema.optional(),
  taxRatePercentage: z.coerce.number().min(0).max(100).default(0),
  /** US-TAX-11 — why an untaxed line has no tax; a taxed line is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional().nullable(),
  /** US-TAX-14 — the line's HSN/SAC code, copied from its item. */
  hsnSac: hsnSacSchema.optional().nullable(),
  /**
   * US-INV-36 (D-219) — the invoice line this credits. The server copies
   * its name, price, rate or group, HSN/SAC and supply class, and works the
   * credit out from the invoice line's own figures: `quantity` of it, or —
   * with `creditAmount` — that amount, tax included.
   */
  invoiceLineId: uuidSchema.optional().nullable(),
  creditAmount: z.coerce.bigint().positive().optional().nullable(),
});

/**
 * PRD F5 (S-05.6) — a draft credit note, always tied to one specific
 * issued invoice. Every money total is absent here, same as
 * createInvoiceSchema — server-computed only, never trusted from the
 * client. `status`/`number`/`journalEntryId`/`issuedAt` are likewise
 * absent — `CreditNotesService.issue` owns that transition, not this
 * input schema.
 */
export const createCreditNoteSchema = z.object({
  invoiceId: uuidSchema,
  reason: z.string().optional().nullable(),
  lines: z.array(creditNoteLineInputSchema).default([]),
  /** US-TAX-13 — the GST place of supply (state code, or "96" for other countries); defaults from the contact. */
  placeOfSupply: placeOfSupplySchema.optional().nullable(),
});

/** A draft-only update — see CreditNotesService.update's own guard against editing an issued credit note. */
// Without the create default: a partial update must not clear the lines.
export const updateCreditNoteSchema = createCreditNoteSchema.omit({ invoiceId: true }).partial().extend({ lines: z.array(creditNoteLineInputSchema).optional() });

/** US-INV-39 — what `GET /credit-notes/:id/activity` returns, newest first. */
export const CREDIT_NOTE_ACTIVITY_TYPES = ["issued", "emailed", "applied", "refunded", "refund_deleted"] as const;
export type CreditNoteActivityType = (typeof CREDIT_NOTE_ACTIVITY_TYPES)[number];
export interface CreditNoteActivityEntry {
  at: string;
  type: CreditNoteActivityType;
  actorName: string | null;
  /** The invoice number (issued, applied), the email address, or the refund's method. */
  detail: string | null;
  /** The invoice (issued, applied) or the refund. */
  linkId?: string | null;
  /** Minor units: what came off the invoice (issued), was applied or refunded. */
  amount?: string | null;
  /** On "issued": the part that became the customer's credit, minor units. */
  creditPart?: string | null;
}

/**
 * US-INV-36 (D-219) — an amount (tax included) spread over invoice lines in
 * proportion to what's left to credit on each. Each part is rounded down
 * and the last line with something left takes the remainder, so the parts
 * add up to the amount exactly; no part is more than its line has left.
 * Returns null when the amount is more than all the lines have left.
 */
export function spreadCreditAmount(leftAmounts: readonly bigint[], amount: bigint): bigint[] | null {
  const totalLeft = leftAmounts.reduce((sum, left) => sum + (left > 0n ? left : 0n), 0n);
  if (amount <= 0n) return leftAmounts.map(() => 0n);
  if (amount > totalLeft) return null;
  const parts = leftAmounts.map((left) => (left > 0n ? (amount * left) / totalLeft : 0n));
  let remainder = amount - parts.reduce((sum, part) => sum + part, 0n);
  // Hand the pennies left over to the lines from the last one up, each up to what it has left.
  for (let i = leftAmounts.length - 1; i >= 0 && remainder > 0n; i--) {
    const room = (leftAmounts[i]! > 0n ? leftAmounts[i]! : 0n) - parts[i]!;
    const add = room < remainder ? room : remainder;
    parts[i] = parts[i]! + add;
    remainder -= add;
  }
  return parts;
}

