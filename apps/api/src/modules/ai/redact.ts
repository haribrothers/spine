/**
 * US-AI-03 (D-165) — text sent to an AI provider never carries bank account
 * numbers, IFSC or routing numbers, IBANs, card numbers, tax IDs (GSTIN, PAN,
 * EIN, SSN, VAT and ABN numbers), UPI IDs, passwords, keys or tokens. Each is
 * replaced with a placeholder that says what was there, so the model can
 * still read the sentence. Amounts, dates, document numbers and email
 * addresses are left alone. A document a person asks AI to read is sent as
 * it is — the feature's "What's sent" says so.
 */
interface Rule {
  label: string;
  pattern: RegExp;
  /** Extra check on a match (e.g. Luhn for card numbers). */
  test?: (match: string) => boolean;
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Luhn's checksum — card numbers pass it; most other long numbers don't. */
function luhn(value: string): boolean {
  const d = digits(value);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

// Order matters: the most specific patterns first, so a GSTIN isn't half-eaten as a PAN.
const RULES: Rule[] = [
  { label: "key", pattern: /\b(?:sk|pk|rk)[-_](?:[A-Za-z]+[-_])?[A-Za-z0-9_-]{16,}\b/g },
  { label: "key", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { label: "password", pattern: /\b(password|passcode|passwd|pin|otp|secret)\b(\s*(?:is|:|=)\s*)\S+/gi },
  { label: "GSTIN", pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g },
  { label: "IBAN", pattern: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g, test: (m) => digits(m).length >= 8 },
  { label: "IFSC", pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { label: "PAN", pattern: /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g },
  { label: "tax ID", pattern: /\b(?:GB|IE|DE|FR|NL|AE)\s?\d{9,12}\b/g },
  { label: "tax ID", pattern: /\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b/g },
  { label: "card number", pattern: /\b(?:\d[ -]?){12,18}\d\b/g, test: luhn },
  { label: "UPI ID", pattern: /\b[\w.-]{2,}@(?!\S*\.)[a-zA-Z]{2,}\b/g },
  // A long run of digits on its own: an account, routing or phone number. Not amounts (they have separators or decimals).
  { label: "account number", pattern: /(?<![\d.,])\d{9,18}(?![\d.,]\d)/g },
  { label: "token", pattern: /\b[A-Za-z0-9+/_-]{40,}={0,2}/g, test: (m) => /\d/.test(m) && /[A-Za-z]/.test(m) },
];

/** The text with every sensitive value replaced by "[<what it was>]". */
export function redact(text: string): string {
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (match: string, ...groups: unknown[]) => {
      if (rule.test && !rule.test(match)) return match;
      // "password: hunter2" keeps the word and drops the value.
      if (rule.label === "password" && typeof groups[0] === "string") return `${groups[0]}${groups[1] as string}[password]`;
      return `[${rule.label}]`;
    });
  }
  return out;
}
