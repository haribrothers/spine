/**
 * US-OPS-22 (D-095) — global search: contacts, quotes, jobs, invoices,
 * credit notes (US-INV-38), payments (US-PAY-25), vendor bills and expenses, up to 5 each, filtered by the same read rules
 * as each module. A document number ("INV-0010", "QUO-4") puts that
 * document first.
 */

export const SEARCH_GROUPS = ["contacts", "quotes", "jobs", "invoices", "credit_notes", "payments", "vendor_bills", "vendor_payments", "expenses"] as const;
export type SearchGroupType = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABELS: Record<SearchGroupType, string> = {
  contacts: "Contacts",
  quotes: "Quotes",
  jobs: "Jobs",
  invoices: "Invoices",
  credit_notes: "Credit notes",
  payments: "Payments",
  vendor_bills: "Vendor bills",
  vendor_payments: "Vendor payments",
  expenses: "Expenses",
};

export interface SearchResult {
  id: string;
  /** "QUO-0004", "Harborview Construction Co.", "JOB-001 · Marina office fit-out" */
  title: string;
  /** "Harborview Construction Co. · $510.00" */
  subtitle: string | null;
  /** "Sent", "Overdue", "Contact" */
  status: string | null;
  href: string;
}

export interface SearchGroup {
  type: SearchGroupType;
  label: string;
  items: SearchResult[];
}

export interface SearchResponse {
  query: string;
  /** Groups with results only; a group holding an exact number match comes first. */
  groups: SearchGroup[];
}

/** The fewest characters that start a search. */
export const SEARCH_MIN_LENGTH = 2;

/** "QUO-4", "quo 0004", "INV0010" → `{ prefix: "QUO", value: 4 }`; anything else → null. */
export function parseDocumentNumber(query: string): { prefix: string; value: number } | null {
  const m = query.trim().match(/^([a-z]{2,6})[\s-]?0*(\d{1,9})$/i);
  return m ? { prefix: m[1]!.toUpperCase(), value: Number(m[2]) } : null;
}

/** Whether a stored number ("QUO-0004", "BILL-2231") is the one the query names. */
export function isNumberMatch(stored: string | null | undefined, query: string): boolean {
  if (!stored) return false;
  if (stored.trim().toLowerCase() === query.trim().toLowerCase()) return true;
  const wanted = parseDocumentNumber(query);
  const have = parseDocumentNumber(stored.replace(/^(.*?)(\d+)$/, (_m, p: string, d: string) => `${p.replace(/[^a-z]/gi, "")}-${d}`));
  return Boolean(wanted && have && wanted.prefix === have.prefix && wanted.value === have.value);
}
