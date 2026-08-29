import type { CreditNoteStatus } from "../invoices/types";

export type { CreditNote, CreditNoteLine, CreditNoteLineType, CreditNoteStatus } from "../invoices/types";

/** Mirrors GET /credit-notes' response shape (CreditNotesService.list) — no `lines`, unlike the single-record GET /credit-notes/:id shape (`CreditNote` in invoices/types.ts). */
export interface CreditNoteRow {
  id: string;
  orgId: string;
  invoiceId: string;
  contactId: string;
  number: string | null;
  status: CreditNoteStatus;
  reason: string | null;
  date: string | null;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdByUserId: string | null;
  issuedAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  contactName: string | null;
  invoiceNumber: string | null;
}

export interface ContactOption {
  id: string;
  name: string;
  archivedAt: string | null;
}
