import type { GstTreatment } from "@spine/shared";
import type { LeadStage, LeadStageKind } from "@spine/shared";

/** Mirrors apps/api/src/db/schema/contacts.ts's row shapes — apps/web has no generated SDK yet (packages/sdk is still empty), so these are hand-written to match the API's JSON response shape. */
export type ContactType = "customer" | "vendor" | "both";
export type AddressType = "billing" | "shipping" | "site" | "other";
export type { LeadStage, LeadStageKind };
export type ActivityType = "call" | "meeting" | "note" | "task";

export interface ContactPerson {
  id: string;
  contactId: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  logoFileId: string | null;
}

export interface Address {
  id: string;
  contactId: string;
  type: AddressType;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isPrimary: boolean;
  /** US-TAX-12 — two-digit GST state code in India. */
  stateCode: string | null;
}

export interface SpineFile {
  id: string;
  orgId: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  orgId: string;
  type: ContactType;
  isCompany: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  taxId: string | null;
  /** US-TAX-12 — null outside India. */
  gstTreatment: GstTreatment | null;
  /** US-TAX-12 — the contact's GST state code. */
  stateCode: string | null;
  website: string | null;
  logoFileId: string | null;
  /** US-INV-19 — skip this contact's invoices in automatic reminders. */
  remindersPaused: boolean;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contactPersons?: ContactPerson[];
  addresses?: Address[];
  duplicateWarning?: Contact[];
}

export interface Lead {
  id: string;
  orgId: string;
  contactId: string;
  /** US-CRM-19 — one of the organisation's pipeline stages. */
  stageId: string;
  stageName: string;
  stageKind: LeadStageKind;
  valueAmount: string;
  valueCurrency: string;
  source: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  orgId: string;
  contactId: string | null;
  leadId: string | null;
  type: ActivityType;
  notes: string | null;
  dueAt: string | null;
  doneAt: string | null;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

