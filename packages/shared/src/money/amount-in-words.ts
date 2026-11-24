import { minorUnitExponent } from "./format.ts";

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0–99: "forty-one". */
function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return ones ? `${TENS[Math.floor(n / 10)]}-${ONES[ones]}` : TENS[Math.floor(n / 10)]!;
}

/** 0–999: "nine hundred"; "five hundred and fifty" internationally, "five hundred fifty" with lakh and crore (the "and" is kept for paise). */
function belowThousand(n: number, and: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundreds) return belowHundred(rest);
  return rest ? `${ONES[hundreds]} hundred${and ? " and" : ""} ${belowHundred(rest)}` : `${ONES[hundreds]} hundred`;
}

/** Whole numbers in words with lakh and crore: 241900 → "two lakh forty-one thousand nine hundred". */
function indianWords(value: bigint): string {
  if (value === 0n) return "zero";
  const parts: string[] = [];
  const crore = value / 10_000_000n;
  let rest = value % 10_000_000n;
  if (crore) parts.push(`${indianWords(crore)} crore`);
  const lakh = Number(rest / 100_000n);
  rest %= 100_000n;
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  const thousand = Number(rest / 1000n);
  rest %= 1000n;
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (rest) parts.push(belowThousand(Number(rest), false));
  return parts.join(" ");
}

const SCALES = ["", " thousand", " million", " billion", " trillion", " quadrillion"];

/** Whole numbers in words with thousand, million, billion: 12500 → "twelve thousand five hundred". */
function internationalWords(value: bigint): string {
  if (value === 0n) return "zero";
  const groups: number[] = [];
  for (let v = value; v > 0n; v /= 1000n) groups.push(Number(v % 1000n));
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) parts.push(`${belowThousand(groups[i]!, true)}${SCALES[i] ?? ""}`);
  }
  // "one thousand and five": a last group under 100 after higher ones takes "and".
  if (groups.length > 1 && groups[0]! > 0 && groups[0]! < 100) parts[parts.length - 1] = `and ${parts[parts.length - 1]}`;
  return parts.join(" ");
}

/** Major and minor unit names (singular, plural). */
const CURRENCY_NAMES: Record<string, [string, string, string, string]> = {
  USD: ["dollar", "dollars", "cent", "cents"],
  AUD: ["dollar", "dollars", "cent", "cents"],
  NZD: ["dollar", "dollars", "cent", "cents"],
  CAD: ["dollar", "dollars", "cent", "cents"],
  SGD: ["dollar", "dollars", "cent", "cents"],
  EUR: ["euro", "euros", "cent", "cents"],
  GBP: ["pound", "pounds", "penny", "pence"],
  ZAR: ["rand", "rand", "cent", "cents"],
  AED: ["dirham", "dirhams", "fils", "fils"],
  SAR: ["riyal", "riyals", "halala", "halalas"],
};

const titleCase = (text: string) => text.replace(/(^|[\s-])([a-z])/g, (_, gap: string, c: string) => gap + c.toUpperCase());

/**
 * US-SET-19 — an amount (minor units) in words, as Indian and other
 * invoices print it. Rupees use lakh and crore and read "Rupees Twelve
 * Thousand Five Hundred and Fifty Paise Only"; other currencies use
 * thousand, million and billion: "Twelve thousand five hundred dollars and
 * fifty cents". A currency without names here ends with its code.
 */
export function amountInWords(amount: bigint, currency: string): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const exponent = minorUnitExponent(currency);
  const factor = 10n ** BigInt(exponent);
  const major = abs / factor;
  const minor = abs % factor;
  const sign = negative ? "minus " : "";

  if (currency === "INR") {
    const rupees = `${negative ? "Minus " : ""}Rupees ${titleCase(indianWords(major))}`;
    const paise = minor ? ` and ${titleCase(indianWords(minor))} Paise` : "";
    return `${rupees}${paise} Only`;
  }

  const names = CURRENCY_NAMES[currency];
  const majorWords = internationalWords(major);
  const text = names
    ? `${majorWords} ${major === 1n ? names[0] : names[1]}${minor ? ` and ${internationalWords(minor)} ${minor === 1n ? names[2] : names[3]}` : ""}`
    : `${majorWords}${minor ? ` and ${internationalWords(minor)} hundredths` : ""} ${currency}`;
  const sentence = sign + text;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
