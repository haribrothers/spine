import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

export const contactTypeSchema = z.enum(["customer", "vendor", "both"]);
export const addressTypeSchema = z.enum(["billing", "shipping", "site", "other"]);
export const leadStageSchema = z.enum(["new", "qualified", "proposal", "won", "lost"]);
export const activityTypeSchema = z.enum(["call", "meeting", "note", "task"]);

export const contactPersonInputSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
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
  contactPersons: z.array(contactPersonInputSchema).optional(),
  addresses: z.array(addressInputSchema).optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  contactPersons: z.array(contactPersonInputSchema).optional(),
  addresses: z.array(addressInputSchema).optional(),
});

export const createLeadSchema = z.object({
  contactId: uuidSchema,
  stage: leadStageSchema.optional(),
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
