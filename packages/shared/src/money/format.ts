import type { Money } from "./money.ts";

/**
 * Minor-unit precision per ISO 4217 for currencies commonly supported by
 * self-hosted installs. Falls back to 2 (the overwhelming majority) for any
 * currency not listed rather than guessing zero-decimal, since that failure
 * mode would silently misplace a decimal point on real money.
 */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency] ?? 2;
}

/** Converts a Money value to its decimal string, e.g. money(124000n, "USD") -> "1240.00". */
export function toDecimalString(value: Money): string {
  const exponent = minorUnitExponent(value.currency);
  const divisor = 10n ** BigInt(exponent);
  const negative = value.amount < 0n;
  const absolute = negative ? -value.amount : value.amount;
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const sign = negative ? "-" : "";
  if (exponent === 0) {
    return `${sign}${whole}`;
  }
  return `${sign}${whole}.${fraction.toString().padStart(exponent, "0")}`;
}

/**
 * Parses a user-typed decimal string into minor units for the given
 * currency. Returns null for input that isn't a valid non-negative decimal
 * with at most `minorUnitExponent(currency)` fractional digits — the caller
 * decides how to surface that (e.g. MoneyInput rejects the keystroke).
 */
export function fromDecimalString(input: string, currency: string): bigint | null {
  const exponent = minorUnitExponent(currency);
  const pattern = exponent === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{0,${exponent}})?$`);
  if (!pattern.test(input)) return null;

  const [wholePart = "0", fractionPart = ""] = input.split(".");
  const paddedFraction = fractionPart.padEnd(exponent, "0");
  return BigInt(wholePart) * 10n ** BigInt(exponent) + BigInt(paddedFraction || "0");
}

/** The true minus sign (U+2212) money is shown with, never a hyphen (D-089). */
export const MINUS_SIGN = "−";

/**
 * US-OPS-24 (D-089) — the one way money is shown: the currency symbol,
 * the locale's grouping and decimal marks, the currency's own number of
 * decimals and a true minus sign. "$12,024.75", "−$4,335.00",
 * "₹1,20,247.50", "12.024,75 €". `amount` is in minor units (a bigint, or
 * the decimal-digit string the API sends).
 */
export function formatMoney(
  amount: bigint | string | number,
  currency: string,
  locale = "en-US",
  options: { currencyDisplay?: "symbol" | "code" | "narrowSymbol" } = {},
): string {
  const code = (currency || "USD").toUpperCase();
  const minor = typeof amount === "bigint" ? amount : BigInt(typeof amount === "number" ? Math.round(amount) : amount || "0");
  const decimals = minorUnitExponent(code);
  const decimal = toDecimalString({ amount: minor, currency: code });
  let formatter: Intl.NumberFormat;
  try {
    const intlOptions: Intl.NumberFormatOptions = {
      style: "currency",
      currency: code,
      currencyDisplay: options.currencyDisplay ?? "symbol",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    };
    try {
      formatter = new Intl.NumberFormat(locale || "en-US", intlOptions);
    } catch {
      formatter = new Intl.NumberFormat("en-US", intlOptions);
    }
  } catch {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  }
  // A decimal string keeps every digit exact; engines without string support get a Number.
  let parts: Intl.NumberFormatPart[];
  try {
    parts = formatter.formatToParts(decimal as unknown as number);
    if (parts.some((p) => p.type === "nan")) throw new Error("no string support");
  } catch {
    parts = formatter.formatToParts(Number(decimal));
  }
  return parts.map((p) => (p.type === "minusSign" ? MINUS_SIGN : p.value)).join("");
}
