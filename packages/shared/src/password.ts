/**
 * US-AUTH-15 (D-207) — how strong a password is, with the checklist the
 * sign-up, reset and Profile forms show. A small built-in check, no
 * dictionary library: length, the mix of letters, numbers and symbols,
 * repeats and sequences, and a short list of the most common passwords.
 * The server enforces only the 8-character minimum and the common list;
 * everything else is guidance.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_TOO_SHORT_MESSAGE = "Use at least 8 characters.";
export const PASSWORD_TOO_COMMON_MESSAGE = "That password is too common. Choose another one.";
export const PASSWORDS_DONT_MATCH_MESSAGE = "The passwords don't match.";

export type PasswordLevel = "too-short" | "weak" | "fair" | "good" | "strong";

export const PASSWORD_LEVEL_LABELS: Record<PasswordLevel, string> = {
  "too-short": "Too short",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export interface PasswordChecks {
  /** Required. */
  minLength: boolean;
  longEnough: boolean;
  mixed: boolean;
  notCommon: boolean;
  noPatterns: boolean;
}

export const PASSWORD_CHECK_LABELS: Record<keyof PasswordChecks, string> = {
  minLength: "At least 8 characters",
  longEnough: "12 or more characters",
  mixed: "Letters, numbers and symbols",
  notCommon: "Not a common password",
  noPatterns: "No repeats or sequences like aaaa or 1234",
};

export interface PasswordStrength {
  level: PasswordLevel;
  /** 0 (too short) to 4 (strong): how many parts of the four-part meter fill. */
  score: 0 | 1 | 2 | 3 | 4;
  checks: PasswordChecks;
}

/**
 * The most common passwords and the obvious variants of them (lower-cased).
 * Checked on the server too (`PASSWORD_TOO_COMMON`), so it stays short and
 * certain rather than clever.
 */
const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
  "12345678", "123456789", "1234567890", "12345678910", "87654321", "11111111", "00000000", "88888888",
  "qwerty123", "qwertyuiop", "qwerty12", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "zaq12wsx", "asdfghjkl", "asdf1234",
  "iloveyou", "iloveyou1", "sunshine", "sunshine1", "princess", "princess1", "football", "football1", "baseball",
  "superman", "batman123", "starwars", "whatever", "trustno1", "letmein1", "letmein123", "welcome1", "welcome123",
  "admin123", "administrator", "changeme", "changeme1", "secret123", "monkey123", "dragon123", "shadow123",
  "master123", "michael1", "jennifer", "computer", "internet", "abcd1234", "abc12345", "abcdefgh", "aaaaaaaa",
  "qazwsxedc", "q1w2e3r4", "football123", "liverpool", "chelsea1", "arsenal1", "pokemon1", "minecraft",
  "spine123", "spinespine", "company1", "business1", "letmeinplease", "default1", "guest123", "test1234",
]);

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Four or more of the same character in a row, or four in a row of a sequence (either way). */
function hasPattern(password: string): boolean {
  const lower = password.toLowerCase();
  if (/(.)\1{3,}/.test(lower)) return true;
  for (const run of SEQUENCES) {
    const both = [run, [...run].reverse().join("")];
    for (let i = 0; i + 4 <= lower.length; i++) {
      const piece = lower.slice(i, i + 4);
      if (both.some((s) => s.includes(piece))) return true;
    }
  }
  return false;
}

export function isCommonPassword(password: string): boolean {
  return COMMON.has(password.trim().toLowerCase());
}

export function passwordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    longEnough: password.length >= 12,
    mixed: /[a-z]/i.test(password) && /\d/.test(password) && /[^a-z\d]/i.test(password),
    notCommon: password.length > 0 && !isCommonPassword(password),
    noPatterns: password.length > 0 && !hasPattern(password),
  };
  if (!checks.minLength) return { level: "too-short", score: 0, checks };
  if (!checks.notCommon) return { level: "weak", score: 1, checks };
  const points = Number(checks.longEnough) + Number(checks.mixed) + Number(checks.noPatterns) + Number(password.length >= 16);
  const level: PasswordLevel = points <= 0 ? "weak" : points === 1 ? "fair" : points === 2 ? "good" : "strong";
  const score = ({ weak: 1, fair: 2, good: 3, strong: 4 } as const)[level];
  return { level, score, checks };
}

/** What a server or form says about a chosen password, or null when it's acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT_MESSAGE;
  if (isCommonPassword(password)) return PASSWORD_TOO_COMMON_MESSAGE;
  return null;
}

/** Words for suggested passwords: short, common and unambiguous to read aloud. */
const WORDS = [
  "amber", "anchor", "apple", "arrow", "aspen", "badge", "basil", "beacon", "birch", "bison", "blaze", "bramble", "brick", "bridge", "cabin", "canyon",
  "cedar", "chalk", "cherry", "cinder", "clover", "comet", "copper", "coral", "cotton", "crane", "creek", "daisy", "delta", "denim", "dune", "ember",
  "falcon", "fern", "field", "flint", "forest", "garnet", "ginger", "glacier", "granite", "grove", "harbor", "hazel", "heron", "hollow", "indigo", "island",
  "jasper", "juniper", "kettle", "lantern", "lark", "lemon", "linen", "maple", "marble", "meadow", "mesa", "mint", "moss", "nectar", "nutmeg", "oak",
  "ocean", "olive", "orbit", "otter", "pebble", "pepper", "pine", "plum", "prairie", "quartz", "quill", "raven", "reed", "ridge", "river", "robin",
  "saffron", "sage", "salt", "sierra", "slate", "sparrow", "spruce", "stone", "summit", "sunset", "thistle", "thunder", "tide", "timber", "topaz", "tulip",
  "valley", "velvet", "violet", "walnut", "willow", "winter", "wren", "yarrow", "zephyr",
];

/** The Web Crypto random source (browsers and Node); this package's types don't include the DOM. */
const webCrypto = (globalThis as unknown as { crypto: { getRandomValues<T extends Uint32Array>(array: T): T } }).crypto;

/** A whole number below `max`, from the platform's cryptographic random source. */
function randomBelow(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do webCrypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}

/**
 * US-TEAM-24 — a password an Owner can read out: three words, one capitalised,
 * and a two-digit number, joined by hyphens ("copper-Tide-48-lantern"). Long,
 * mixed and pattern-free, so it rates Strong.
 */
export function generatePassword(): string {
  const pick = () => WORDS[randomBelow(WORDS.length)]!;
  const words = [pick(), pick(), pick()];
  const cap = randomBelow(3);
  words[cap] = words[cap]!.charAt(0).toUpperCase() + words[cap]!.slice(1);
  const number = String(10 + randomBelow(90));
  return [words[0], words[1], number, words[2]].join("-");
}
