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
