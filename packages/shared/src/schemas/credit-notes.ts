import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

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
});

/** A draft-only update — see CreditNotesService.update's own guard against editing an issued credit note. */
export const updateCreditNoteSchema = createCreditNoteSchema.omit({ invoiceId: true }).partial();
