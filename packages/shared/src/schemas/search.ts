import { z } from "zod";
import { minorUnitExponent } from "../money/format.ts";

/**
 * US-OPS-22 (D-095) — global search: contacts, quotes, jobs, invoices,
 * credit notes (US-INV-38), payments (US-PAY-25), vendor bills and expenses, up to 5 each, filtered by the same read rules
 * as each module. A document number ("INV-0010", "QUO-4") puts that
 * document first. US-OPS-43 (D-238) adds leads, meetings, catalogue items
 * and vendor credits; groups follow the sidebar's order.
 */

export const SEARCH_GROUPS = ["contacts", "leads", "meetings", "catalog_items", "quotes", "jobs", "invoices", "credit_notes", "payments", "vendor_bills", "vendor_credits", "vendor_payments", "expenses"] as const;
export type SearchGroupType = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABELS: Record<SearchGroupType, string> = {
  contacts: "Contacts",
  leads: "Leads",
  meetings: "Meetings",
  catalog_items: "Catalogue",
  quotes: "Quotes",
  jobs: "Jobs",
  invoices: "Invoices",
  credit_notes: "Credit notes",
  payments: "Payments",
  vendor_bills: "Vendor bills",
  vendor_credits: "Vendor credits",
  vendor_payments: "Vendor payments",
  expenses: "Expenses",
};

/** US-OPS-40 — the list each group's "See all … matching" opens (`?q=`); Meetings has no search box. */
export const SEARCH_GROUP_LIST_HREF: Record<SearchGroupType, string | null> = {
  contacts: "/contacts",
  leads: "/leads",
  meetings: null,
  catalog_items: "/catalog",
  quotes: "/quotes",
  jobs: "/jobs",
  invoices: "/invoices",
  credit_notes: "/credit-notes",
  payments: "/payments",
  vendor_bills: "/vendor-bills",
  vendor_credits: "/vendor-credits",
  vendor_payments: "/vendor-payments",
  expenses: "/expenses",
};

/** US-OPS-49 — the chips: the sidebar's areas and the groups each one searches. */
export const SEARCH_SCOPES = {
  sales: ["contacts", "leads", "meetings", "catalog_items", "quotes"],
  jobs: ["jobs"],
  billing: ["invoices", "credit_notes", "payments"],
  purchases: ["vendor_bills", "vendor_credits", "vendor_payments", "expenses"],
} as const satisfies Record<string, readonly SearchGroupType[]>;
export type SearchScope = keyof typeof SEARCH_SCOPES;
export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = { sales: "Sales", jobs: "Jobs", billing: "Billing", purchases: "Purchases" };

/** Results a group shows: 5 across everything, up to 20 when narrowed to an area (`types`). */
export const SEARCH_LIMIT = 5;
export const SEARCH_SCOPED_LIMIT = 20;

export interface SearchResult {
  id: string;
  /** The group it belongs to (US-OPS-39: recent records carry it too). */
  type: SearchGroupType;
  /** "QUO-0004", "Harborview Construction Co.", "JOB-001 · Marina office fit-out" */
  title: string;
  /** "Harborview Construction Co. · $510.00" */
  subtitle: string | null;
  /** "Sent", "Overdue", "Contact" */
  status: string | null;
  href: string;
  /** Text to bold instead of the query when something else matched (an amount, a phone number, a contact person). */
  highlight?: string | null;
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

/** US-OPS-39 — how many recent records and searches are kept, and how many are shown. */
export const RECENT_ITEMS_KEPT = 10;
export const RECENT_SEARCHES_KEPT = 5;
export const RECENT_ITEMS_SHOWN = 5;
export const RECENT_SEARCHES_SHOWN = 3;

export interface SearchRecentResponse {
  /** Up to 5, newest first, read now with today's access. */
  items: SearchResult[];
  /** Up to 3, newest first. */
  searches: string[];
}

/** `POST /search/recent`: a record that was opened, or a search a result was opened from. */
export const recordRecentSchema = z.union([
  z.object({ type: z.enum(SEARCH_GROUPS, { message: "Choose what to search." }), id: z.string().uuid() }).strict(),
  z.object({ query: z.string().trim().max(100) }).strict(),
]);
export type RecordRecentInput = z.infer<typeof recordRecentSchema>;

/** `types=` → the groups, or null when one isn't a group. */
export function parseSearchTypes(raw: string | undefined | null): SearchGroupType[] | null {
  if (!raw) return [];
  const types = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return types.every((t): t is SearchGroupType => (SEARCH_GROUPS as readonly string[]).includes(t)) ? [...new Set(types)] : null;
}

/** The locale's grouping and decimal marks ("en-US" → "," and "."; "de-DE" → "." and ","). */
function numberMarks(locale: string): { group: string; decimal: string } {
  let group = ",";
  let decimal = ".";
  try {
    for (const part of new Intl.NumberFormat(locale).formatToParts(12345.6)) {
      if (part.type === "group") group = part.value;
      if (part.type === "decimal") decimal = part.value;
    }
  } catch {
    // An unknown locale reads like en-US.
  }
  return { group, decimal };
}

/**
 * US-OPS-45 — what's typed as an amount in the business's format, in minor
 * units: "2,389.50", "2389.5", "$2,389.50", "₹1,20,247" and "2389" read as
 * amounts; "INV-0010", "12.345" (too many decimals) and "2,38,9.1.2" don't.
 * Grouping marks must sit between groups of 2 or 3 digits; a currency
 * symbol or code may lead or follow.
 */
export function parseSearchAmount(query: string, locale: string, currency: string): bigint | null {
  const { group, decimal } = numberMarks(locale);
  const exponent = minorUnitExponent(currency);
  // A currency symbol ("$", "US$", "₹", "€") or the currency's code ("USD", "Rs" for rupees) may lead or follow — never other letters,
  // so "INV-0010" or "QU-12" isn't an amount.
  const code = currency === "INR" ? `${currency}|Rs\\.?` : currency;
  const mark = `(?:[A-Za-z]{0,2}\\p{Sc}|${code})`;
  const text = query
    .trim()
    .replace(new RegExp(`^${mark}\\s?`, "iu"), "")
    .replace(new RegExp(`\\s?${mark}$`, "iu"), "")
    .trim();
  // Spaces and non-breaking spaces group digits in some locales.
  const g = /\s/u.test(group) ? "\\s" : group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const d = decimal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fraction = exponent > 0 ? `(?:${d}(\\d{1,${exponent}}))?` : "";
  const match = text.match(new RegExp(`^(\\d{1,3}(?:${g}\\d{2,3})+|\\d+)${fraction}$`, "u"));
  if (!match) return null;
  const whole = match[1]!.replace(/\D/g, "");
  if (whole.length > 13) return null;
  const minor = (match[2] ?? "").padEnd(exponent, "0");
  return BigInt(whole) * 10n ** BigInt(exponent) + BigInt(minor || "0");
}

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
