import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

export const contactTypeSchema = z.enum(["customer", "vendor", "both"]);
export const addressTypeSchema = z.enum(["billing", "shipping", "site", "other"]);
export const activityTypeSchema = z.enum(["call", "meeting", "note", "task"]);

export const contactPersonInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
  logoFileId: uuidSchema.optional().nullable(),
});

export const addressInputSchema = z.object({
  id: uuidSchema.optional(),
  type: addressTypeSchema.optional(),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

/**
 * Nested contact-persons/addresses are managed via the contact's own
 * create/update payload as full-replace arrays (see task brief — this
 * codebase has no other nested-sub-resource precedent to follow, so this
 * shape was chosen: simpler for a small, bounded list per contact than a
 * separate CRUD endpoint per person/address, and matches how a "contact
 * detail page" naturally saves — one form, one submit).
 */
export const createContactSchema = z.object({
  type: contactTypeSchema,
  isCompany: z.boolean().default(false),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Targeted field additions (task brief Phase 4) — a tax ID for invoicing
  // a business contact and a website, both optional free text.
  taxId: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  logoFileId: uuidSchema.optional().nullable(),
  contactPersons: z.array(contactPersonInputSchema).optional(),
  addresses: z.array(addressInputSchema).optional(),
});

/**
 * Deliberately NOT `createContactSchema.partial()` — zod's `.partial()`
 * only marks a field optional, it doesn't stop a `ZodDefault` from firing
 * when the field is absent from the request body. `isCompany`'s
 * `.default(false)` on the create schema would silently resolve every
 * partial update that omits `isCompany` (e.g. a logo-only PUT) to `false`,
 * even though `ContactsService.update()` already correctly gates the write
 * behind `input.isCompany !== undefined` — that check is defeated upstream
 * once the default has already filled it in. Redeclaring the shape here
 * with plain `.optional()` (no `.default()`) keeps "absent from the
 * request" genuinely distinguishable from "explicitly set."
 */
export const updateContactSchema = z.object({
  type: contactTypeSchema.optional(),
  isCompany: z.boolean().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  logoFileId: uuidSchema.optional().nullable(),
  /** US-INV-19 — "Pause automatic reminders" for this contact's invoices. */
  remindersPaused: z.boolean().optional(),
  contactPersons: z.array(contactPersonInputSchema).optional(),
  addresses: z.array(addressInputSchema).optional(),
});

export const createLeadSchema = z.object({
  contactId: uuidSchema,
  /** US-CRM-19 — one of the organisation's pipeline stages; the first open stage when omitted. */
  stageId: uuidSchema.optional(),
  valueAmount: z.coerce.bigint().optional(),
  valueCurrency: currencyCodeSchema,
  source: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const createActivitySchema = z
  .object({
    contactId: uuidSchema.optional().nullable(),
    leadId: uuidSchema.optional().nullable(),
    type: activityTypeSchema,
    notes: z.string().optional().nullable(),
    dueAt: z.coerce.date().optional().nullable(),
    assignedToUserId: z.string().optional().nullable(),
  })
  .refine((value) => Boolean(value.contactId) || Boolean(value.leadId), {
    message: "An activity must be linked to a contact or a lead",
  });

export const updateActivitySchema = z.object({
  type: activityTypeSchema.optional(),
  notes: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
});
