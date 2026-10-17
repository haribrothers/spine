import { minorUnitExponent } from "@spine/shared";

/**
 * US-AI-08 (D-170) — Spine, not the model, matches what was read to the
 * business's own vendors, items and tax rates. Pure functions, so the
 * rules are tested without a provider.
 */

const LEGAL_WORDS = new Set(["pvt", "private", "ltd", "limited", "llp", "llc", "inc", "incorporated", "co", "company", "corp", "corporation", "plc", "gmbh", "the", "and", "m/s", "ms"]);

/** "M/s. Apex Building Materials Pvt. Ltd." → "apex building materials". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/m\/s\.?/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && !LEGAL_WORDS.has(word))
    .join(" ");
}

/**
 * The one candidate whose name matches: the same once legal words and
 * punctuation are ignored, else the only one whose name contains the
 * other's (at least 4 letters). Two possible matches is no match — the
 * person chooses.
 */
export function matchByName<T extends { name: string }>(name: string, candidates: readonly T[]): T | null {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const exact = candidates.filter((c) => normalizeName(c.name) === wanted);
  if (exact.length) return exact.length === 1 ? exact[0]! : null;
  const partial = candidates.filter((c) => {
    const theirs = normalizeName(c.name);
    const shorter = theirs.length < wanted.length ? theirs : wanted;
    return shorter.length >= 4 && (theirs.includes(wanted) || wanted.includes(theirs));
  });
  return partial.length === 1 ? partial[0]! : null;
}

/** "1,20,500.505", "₹410", "INR 410" or 120500.505 → minor units, rounded half-up once; null for anything that isn't a non-negative amount. */
export function decimalToMinor(value: string | number, currency: string): bigint | null {
  const text = typeof value === "number" ? (Number.isFinite(value) ? value.toFixed(6) : "") : value.replace(/[,\s]/g, "").replace(/^(?:[A-Z]{3}|Rs\.?|[^\p{L}\p{N}.-])/u, "");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const exponent = minorUnitExponent(currency);
  const fraction = (m[2] ?? "").padEnd(exponent + 1, "0");
  const kept = BigInt(m[1]! + fraction.slice(0, exponent));
  return Number(fraction[exponent]) >= 5 ? kept + 1n : kept;
}

export interface TaxOption {
  kind: "rate" | "group";
  id: string;
  percent: number;
  /** Where it applies: within the state (CGST + SGST), across states (IGST), or either. */
  scope: "intra" | "inter" | "any";
}

/**
 * A rate or group with the document's percentage, for the supply type:
 * inter-state picks IGST, intra-state CGST + SGST, otherwise anything
 * that applies either way. A component (CGST alone) is never picked.
 */
export function matchTax(percent: number | null, side: "intra" | "inter" | null, options: readonly TaxOption[]): TaxOption | null {
  if (percent === null || percent <= 0) return null;
  const same = options.filter((o) => Math.abs(o.percent - percent) < 0.001);
  const wanted = side ?? "any";
  return same.find((o) => o.scope === wanted) ?? same.find((o) => o.scope === "any") ?? null;
}

/** "Payment due within 30 days" / "Net 30" / "30 days" → 30; null when the words don't say. */
export function daysFromTerms(terms: string): number | null {
  const lower = terms.toLowerCase();
  if (/\b(on|upon) receipt\b|\bdue immediately\b/.test(lower)) return 0;
  const m = /\bnet\s*(\d{1,3})\b/.exec(lower) ?? /\b(\d{1,3})\s*days?\b/.exec(lower);
  return m ? Number(m[1]) : null;
}

/** `2026-10-14` plus 30 days → `2026-11-13`. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
