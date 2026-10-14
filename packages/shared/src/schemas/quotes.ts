import { z } from "zod";
import { currencyCodeSchema, hsnSacSchema, placeOfSupplySchema, uuidSchema } from "./common.ts";
import { SUPPLY_CLASSES } from "../tax/supply-class.ts";

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
  /** Legacy flat-percentage fallback, used only when neither taxRateId nor taxGroupId is set (FEAT-08). */
  taxRatePercentage: z.coerce.number().min(0).max(100).default(0),
  /** At most one of these two — QuotesService rejects both being set. */
  taxRateId: uuidSchema.optional().nullable(),
  taxGroupId: uuidSchema.optional().nullable(),
  /** S-08.2 — whether this line's unitPriceAmount is entered tax-inclusive. Defaults to the org's own setting client-side; always explicit on the wire. */
  isTaxInclusive: z.boolean().default(false),
  /** US-TAX-11 — why an untaxed line has no tax; a taxed line is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional().nullable(),
  /** US-TAX-14 — the line's HSN/SAC code, copied from its item. */
  hsnSac: hsnSacSchema.optional().nullable(),
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
 * NOTE on the `.partial()` pitfall: zod still applies a field's
 * `.default()` after `.partial()`, so `lines: [...].default([])` would
 * clear a draft's lines on any update that leaves them out.
 * `updateQuoteSchema` below redeclares `lines` as optional for that reason
 * (as invoices, credit notes, bills, vendor credits and expenses do).
 */
/** US-QUO-30 — an optional quote title. */
export const QUOTE_TITLE_MAX = 120;
export const QUOTE_TITLE_TOO_LONG = "Keep the title under 120 characters.";

export const createQuoteSchema = z.object({
  contactId: uuidSchema,
  title: z.string().trim().max(QUOTE_TITLE_MAX, QUOTE_TITLE_TOO_LONG).optional().nullable(),
  currency: currencyCodeSchema,
  validUntil: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  lines: z.array(quoteLineInputSchema).default([]),
  /** US-TAX-13 — the GST place of supply (state code, or "96" for other countries); defaults from the contact. */
  placeOfSupply: placeOfSupplySchema.optional().nullable(),
  /** US-CRM-26 — the lead this quote is for (same organisation and contact). */
  leadId: uuidSchema.optional().nullable(),
});

/** A draft-only update — see QuotesService.update's own guard against editing a sent quote. */
// Without the create default: a partial update must not clear the lines.
export const updateQuoteSchema = createQuoteSchema.partial().extend({ lines: z.array(quoteLineInputSchema).optional() });

/**
 * Phase 5 (Mobile, S-11.7) — `POST /quotes/:id/accept-in-person`. The
 * signature is uploaded first via the existing `POST /files` (two-step
 * upload, same pattern as every other file-attaching endpoint in this
 * codebase — see addJobPhotoSchema's own comment) and referenced here by
 * id, never sent inline.
 */
export const acceptQuoteInPersonSchema = z.object({
  signatureFileId: uuidSchema,
  /** US-QUO-19 — the name the customer typed above their signature. */
  signerName: z.string().trim().min(1, "Enter the name of the person signing.").max(200),
  comment: z.string().optional().nullable(),
});

/** US-MOB-16 — `POST /quotes/:id/reject-in-person`: the customer declines on site, with an optional reason. */
export const rejectQuoteInPersonSchema = z.object({
  comment: z.string().trim().max(2000).optional().nullable(),
});

/** US-QUO-32 — one entry in a quote's Activity panel (`GET /quotes/:id/activity`), newest first. */
export const QUOTE_ACTIVITY_TYPES = [
  "created",
  "edited",
  "discount_approved",
  "sent",
  "emailed",
  "email_failed",
  "link_copied",
  "viewed",
  "revised",
  "duplicated",
  "accepted",
  "rejected",
  "converted_to_invoice",
  "converted_to_job",
] as const;
export type QuoteActivityType = (typeof QUOTE_ACTIVITY_TYPES)[number];
export interface QuoteActivityEntry {
  at: string;
  type: QuoteActivityType;
  actorName: string | null;
  /** The comment on an answer, the email address or error, the number of what it became or came from. */
  detail: string | null;
  /** The record it points at: the version revised from, or the invoice or job made. */
  linkId?: string | null;
  /** "in_person" or "public_link" for an answer. */
  method?: "in_person" | "public_link" | null;
}

/** US-QUO-33 — what a quote is connected to (`GET /quotes/:id/related`). */
export interface QuoteRelated {
  lead: { id: string; title: string | null } | null;
  versions: { id: string; version: number; number: string | null; status: "draft" | "sent" | "accepted" | "rejected"; isExpired: boolean; createdAt: string }[];
  jobs: { id: string; number: string | null; name: string; status: string }[];
  invoices: { id: string; number: string | null; status: string }[];
}

/** US-QUO-31 — `POST /quotes/:id/link`. */
export interface QuoteCustomerLink {
  url: string;
  expiresAt: string;
}

/** US-QUO-31 — the 400 when a quote has no customer link to copy. */
export const QUOTE_NO_LINK = "Only a sent quote has a customer link.";
