import type { ContactType } from "../types";
import { t } from "../../../../lib/i18n";

/** Spine fields a CSV column can be mapped to. `"skip"` means "don't map this column to anything." */
export const IMPORT_FIELDS = ["name", "type", "isCompany", "email", "phone", "notes", "taxId", "gstin", "stateCode", "website"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: t("contacts.importFields.name"),
  type: t("contacts.importFields.type"),
  isCompany: t("contacts.importFields.isCompany"),
  email: t("contacts.importFields.email"),
  phone: t("contacts.importFields.phone"),
  notes: t("contacts.importFields.notes"),
  taxId: t("contacts.importFields.taxId"),
  // US-TAX-12 — a GSTIN makes the contact a registered business.
  gstin: t("contacts.importFields.gstin"),
  stateCode: t("contacts.importFields.stateCode"),
  website: t("contacts.importFields.website"),
};

export const REQUIRED_IMPORT_FIELDS: ImportField[] = ["name", "type"];

/** Column header -> Spine field, or `null` for "not mapped." */
export type ColumnMapping = Record<string, ImportField | null>;

export interface ImportRow {
  rowNumber: number; // 1-indexed, matches the CSV's own row numbering (excluding header) for user-facing messages
  raw: Record<string, string>;
  name: string;
  type: ContactType | null;
  isCompany: boolean;
  email: string | null;
  phone: string | null;
  notes: string | null;
  taxId: string | null;
  /** US-TAX-12 — set when a GSTIN column is mapped. */
  gstTreatment: "registered" | null;
  stateCode: string | null;
  website: string | null;
  errors: string[];
  duplicateOf: string[]; // names of existing contacts this row matches by email/phone
  included: boolean;
}

export type ImportRowResult = { rowNumber: number; status: "created" | "error"; message?: string; duplicateOf?: string[] };
