import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

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
});

/** A draft-only update — see InvoicesService.update's own guard against editing an issued invoice. */
export const updateInvoiceSchema = createInvoiceSchema.partial();

/** S-05.8 — void requires a reason, per the PRD's own wording ("void an invoice with a reason"). */
export const voidInvoiceSchema = z.object({
  reason: z.string().min(1, "A reason is required to void an invoice"),
});
