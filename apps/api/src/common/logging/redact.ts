/**
 * US-OPS-07 — what never reaches a log line: passwords, tokens, secrets,
 * cookies and full card or bank numbers. Applied to every message and stack
 * the API logs, and to request paths.
 */

const SECRET_KEYS = "password|newPassword|currentPassword|passphrase|token|accessToken|access_token|refreshToken|refresh_token|idToken|id_token|sessionToken|session_token|secret|clientSecret|client_secret|apiKey|api_key|authorization|cookie|code_verifier|otp|totpCode|backupCode";
/** `"password":"…"`, `password=…`, `token: …` — the value goes, the key stays. */
const KEY_VALUE = new RegExp(`(["']?(?:${SECRET_KEYS})["']?\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s,;&}\\]]+)`, "gi");
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
/** Cookie headers (`better-auth.session_token=…`). */
const COOKIE = /\b([\w.-]*(?:session|token|csrf)[\w.-]*)=([^;\s&]+)/gi;
/** IBANs: two letters, two digits, then 11–30 letters or digits. */
const IBAN = /\b([A-Z]{2}\d{2})[A-Z0-9]{7,26}([A-Z0-9]{4})\b/g;
/** 9–19 digits, optionally grouped with spaces or dashes (cards, bank accounts) — not inside a word or id. */
const LONG_NUMBER = /(?<![\w-])\d(?:[ -]?\d){8,18}(?![\w-])/g;

function maskDigits(run: string): string {
  const digits = run.replace(/\D/g, "");
  return `${"•".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function redact(text: string): string {
  return text
    .replace(BEARER, "$1 [redacted]")
    .replace(KEY_VALUE, "$1[redacted]")
    .replace(COOKIE, "$1=[redacted]")
    .replace(IBAN, "$1••••$2")
    .replace(LONG_NUMBER, maskDigits);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A request's path as logged: no query string (signed file links and OAuth
 * redirects carry secrets there), and any segment that looks like a token —
 * 20 or more URL-safe characters that aren't a record id — replaced, so a
 * public quote or invitation link can't be replayed from the logs.
 */
export function loggablePath(url: string): string {
  const path = url.split("?")[0] ?? "";
  return path
    .split("/")
    .map((segment) => (segment.length >= 20 && /^[A-Za-z0-9_.~-]+$/.test(segment) && !UUID.test(segment) ? "[token]" : segment))
    .join("/");
}
