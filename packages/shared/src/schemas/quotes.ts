import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

export const quoteLineTypeSchema = z.enum(["item", "heading", "text"]);

/**
 * A single quote line as sent from the client. `catalogItemId` is optional
 * provenance only (see quotes.ts's schema comment) — every money/tax/name
 * field is always taken from THIS payload, never re-read from the catalog
 * item server-side, per CLAUDE.md's "documents snapshot their data" rule.
 *
 * `quantity`/`discountPercentage`/`taxRatePercentage` default to 0 so a
 * `heading`/`text` line can omit them entirely; an `item` line's own
 * QuotesService validation (not this schema) is what actually requires a
 * sensible quantity/price for that line type — keeping this schema
 * permissive here means one shape covers all three line kinds without a
 * z.discriminatedUnion, matching quotes.ts's own "one table, one shape"
 * design.
 */
export const quoteLineInputSchema = z.object({
  id: uuidSchema.optional(),
  type: quoteLineTypeSchema.default("item"),
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
 * PRD F3 / S-03.1, S-03.2, S-03.11 — a draft quote. `totalAmount` and every
 * other money total are deliberately absent from this input schema: they
 * are always server-computed from `lines` in QuotesService, never accepted
 * from the client, per CLAUDE.md's non-negotiable money rule ("never trust
 * a client-supplied total"). `status`/`number`/`discountRequiresApproval`/
 * `approvedByUserId`/`approvedAt` are likewise absent — they're state this
 * schema's callers (create/update/send/revise/approve-discount) transition
 * through dedicated service methods, not raw fields a client can set.
 *
 * NOTE on the `.partial()` pitfall documented in catalog.ts's own schema
 * comment: this schema has no top-level `z.boolean().default(...)` field,
 * so `updateQuoteSchema = createQuoteSchema.partial()` below is safe as-is.
 * If one is ever added, do not rely on a shared `.default()` on a field
 * that also needs `.partial()` — handle its default explicitly at the call
 * site instead.
 */
export const createQuoteSchema = z.object({
  contactId: uuidSchema,
  currency: currencyCodeSchema,
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  lines: z.array(quoteLineInputSchema).default([]),
});

/** A draft-only update — see QuotesService.update's own guard against editing a sent quote. */
export const updateQuoteSchema = createQuoteSchema.partial();
