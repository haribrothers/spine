import type { Contact, ContactType } from "../types";
import type { ColumnMapping, ImportRow } from "./types";

const VALID_TYPES = new Set<ContactType>(["customer", "vendor", "both"]);
const TRUE_VALUES = new Set(["true", "yes", "y", "1"]);
// Same shape zod's z.string().email() accepts — kept in sync manually since
// this runs client-side before the row ever reaches the shared zod schema;
// the point is to catch what the server would reject BEFORE submit, not to
// re-validate after.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeType(raw: string): ContactType | null {
  const value = raw.trim().toLowerCase();
  if (VALID_TYPES.has(value as ContactType)) return value as ContactType;
  return null;
}

/**
 * Pure transform from parsed CSV rows + a column mapping to `ImportRow`s —
 * kept separate from the wizard's own state/UI so the validation/duplicate
 * logic is easy to reason about (and re-run) independently of React.
 * Duplicate matching mirrors `ContactsService.findDuplicates`'s own
 * case-insensitive email/phone match, run client-side against the
 * already-loaded contact list rather than a new API round-trip per row.
 */
export function buildImportRows(
  parsedRows: Record<string, string>[],
  mapping: ColumnMapping,
  existingContacts: Contact[],
): ImportRow[] {
  const fieldToColumn = new Map<string, string>();
  for (const [column, field] of Object.entries(mapping)) {
    if (field) fieldToColumn.set(field, column);
  }

  function get(raw: Record<string, string>, field: string): string {
    const column = fieldToColumn.get(field);
    return column ? (raw[column] ?? "").trim() : "";
  }

  return parsedRows.map((raw, index) => {
    const name = get(raw, "name");
    const typeRaw = get(raw, "type");
    const type = typeRaw ? normalizeType(typeRaw) : null;
    const email = get(raw, "email") || null;
    const phone = get(raw, "phone") || null;
    const isCompanyRaw = get(raw, "isCompany").toLowerCase();

    const errors: string[] = [];
    if (!name) errors.push("Missing name");
    if (!typeRaw) errors.push("Missing type");
    else if (!type) errors.push(`Invalid type "${typeRaw}" — must be customer, vendor, or both`);
    if (email && !EMAIL_PATTERN.test(email)) errors.push(`Invalid email "${email}"`);

    const duplicateOf = existingContacts
      .filter(
        (c) =>
          (email && c.email && c.email.toLowerCase() === email.toLowerCase()) ||
          (phone && c.phone && c.phone.toLowerCase() === phone.toLowerCase()),
      )
      .map((c) => c.name);

    return {
      rowNumber: index + 1,
      raw,
      name,
      type,
      isCompany: TRUE_VALUES.has(isCompanyRaw),
      email,
      phone,
      notes: get(raw, "notes") || null,
      taxId: get(raw, "taxId") || null,
      website: get(raw, "website") || null,
      errors,
      duplicateOf,
      included: errors.length === 0,
    };
  });
}
