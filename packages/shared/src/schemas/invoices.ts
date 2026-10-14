import { z } from "zod";
import { currencyCodeSchema, hsnSacSchema, placeOfSupplySchema, uuidSchema } from "./common.ts";
import { SUPPLY_CLASSES } from "../tax/supply-class.ts";

export const invoiceLineTypeSchema = z.enum(["item", "heading", "text"]);
export const invoiceTypeSchema = z.enum(["standard", "advance", "progress", "retention_release"]);

/** Structurally identical to quoteLineInputSchema — see quotes.ts's own doc comment for the full reasoning (one permissive shape covers item/heading/text, server always recomputes totals). */
export const invoiceLineInputSchema = z.object({
  id: uuidSchema.optional(),
  type: invoiceLineTypeSchema.default("item"),
  catalogItemId: uuidSchema.optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0).default(0),
  unitPriceAmount: z.coerce.bigint().default(0n),
  unitPriceCurrency: currencyCodeSchema.optional(),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  taxRatePercentage: z.coerce.number().min(0).max(100).default(0),
  taxRateId: uuidSchema.optional().nullable(),
  taxGroupId: uuidSchema.optional().nullable(),
  isTaxInclusive: z.boolean().default(false),
  /** US-TAX-11 — why an untaxed line has no tax; a taxed line is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional().nullable(),
  /** US-TAX-14 — the line's HSN/SAC code, copied from its item. */
  hsnSac: hsnSacSchema.optional().nullable(),
});

/**
 * PRD F5 (S-05.1, S-05.2) — a draft invoice, created from scratch. Every
 * money total is absent here, same as createQuoteSchema — server-computed
 * only, never trusted from the client. `status`/`number`/`journalEntryId`/
 * `issuedAt`/`voidedAt` are likewise absent — dedicated service methods
 * (issue/void) own those transitions, not this input schema.
 */
export const createInvoiceSchema = z.object({
  contactId: uuidSchema,
  type: invoiceTypeSchema.default("standard"),
  currency: currencyCodeSchema,
  issueDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  lines: z.array(invoiceLineInputSchema).default([]),
  /** US-TAX-13 — the GST place of supply (state code, or "96" for other countries); defaults from the contact. */
  placeOfSupply: placeOfSupplySchema.optional().nullable(),
});

/** A draft-only update — see InvoicesService.update's own guard against editing an issued invoice. */
// Without the create defaults: a partial update must not reset the type or clear the lines.
export const updateInvoiceSchema = createInvoiceSchema.partial().extend({ type: invoiceTypeSchema.optional(), lines: z.array(invoiceLineInputSchema).optional() });

/** S-05.8 — void requires a reason, per the PRD's own wording ("void an invoice with a reason"). */
export const voidInvoiceSchema = z.object({
  reason: z.string().min(1, "A reason is required to void an invoice"),
});

/** US-INV-32 — what `GET /invoices/:id/activity` returns, newest first. */
export const INVOICE_ACTIVITY_TYPES = [
  "created",
  "created_from_quote",
  "created_from_milestone",
  "duplicated",
  "edited",
  "issued",
  "emailed",
  "email_failed",
  "reminder_sent",
  "auto_reminder_sent",
  "payment_recorded",
  "credit_applied",
  "credit_note_issued",
  "voided",
] as const;
export type InvoiceActivityType = (typeof INVOICE_ACTIVITY_TYPES)[number];
export interface InvoiceActivityEntry {
  at: string;
  type: InvoiceActivityType;
  actorName: string | null;
  /**
   * The quote or source invoice number, the milestone's name, the email
   * address or error, the payment's amount (minor units) and receipt
   * number, the credit note's number, or the void reason.
   */
  detail: string | null;
  /** What it points at: the quote, job, source invoice, payment or credit note. */
  linkId?: string | null;
  /** For a payment or credit: the amount in minor units. */
  amount?: string | null;
  /** For a payment: how it was paid ("bank_transfer"). */
  method?: string | null;
}
