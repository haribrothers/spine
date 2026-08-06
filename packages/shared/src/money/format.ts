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
