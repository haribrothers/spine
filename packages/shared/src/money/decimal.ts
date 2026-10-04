/**
 * Exact decimal arithmetic for quantities, prices and percentages (D-004,
 * D-118). Values are read from their shortest decimal string ("8.875",
 * "0.1"), never from their binary floating-point value, and multiplied as
 * exact fractions of bigints. Rounding happens once, at the end, half-up.
 *
 * Inputs may be numbers: quantities and rates are stored as numeric(18,4)
 * and a JavaScript number's shortest string is the exact decimal for any
 * value with up to 15 significant digits, which covers every realistic
 * quantity, price and rate.
 */

/** An exact fraction n / d, with d > 0. */
export interface Fraction {
  readonly n: bigint;
  readonly d: bigint;
}

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i;

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function reduce(n: bigint, d: bigint): Fraction {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return g > 1n ? { n: n / g, d: d / g } : { n, d };
}

/** The exact value of a decimal number or decimal string ("12.5", "-0.0875", 3, 1e-4). */
export function decimal(value: number | string | bigint): Fraction {
  if (typeof value === "bigint") return { n: value, d: 1n };
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`Not a finite number: ${value}`);
  const text = String(value).trim();
  const match = DECIMAL.exec(text);
  if (!match) throw new Error(`Not a decimal number: ${text}`);
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  let n = BigInt(`${whole}${fraction}`);
  let d = 10n ** BigInt(fraction.length);
  const exp = Number(exponent);
  if (exp > 0) n *= 10n ** BigInt(exp);
  if (exp < 0) d *= 10n ** BigInt(-exp);
  return reduce(sign ? -n : n, d);
}

export const ZERO: Fraction = { n: 0n, d: 1n };
export const ONE: Fraction = { n: 1n, d: 1n };

export function plus(a: Fraction, b: Fraction): Fraction {
  return reduce(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function times(a: Fraction, b: Fraction): Fraction {
  return reduce(a.n * b.n, a.d * b.d);
}

export function dividedBy(a: Fraction, b: Fraction): Fraction {
  if (b.n === 0n) throw new Error("Division by zero");
  return reduce(a.n * b.d, a.d * b.n);
}

/** A percentage as a fraction: percent(8.875) is 8875/100000. */
export function percent(value: number | string): Fraction {
  return dividedBy(decimal(value), { n: 100n, d: 1n });
}

/** Rounds to a whole number, half-up (towards +∞ on a tie), the single rounding step per line. */
export function roundFraction(value: Fraction): bigint {
  // floor((2n + d) / 2d), with floor division for negatives.
  const num = 2n * value.n + value.d;
  const den = 2n * value.d;
  const q = num / den;
  return num % den !== 0n && num < 0n ? q - 1n : q;
}

/** `amountMinor × factor`, rounded half-up once. */
export function multiplyMinor(amountMinor: bigint, factor: number | string): bigint {
  return roundFraction(times({ n: amountMinor, d: 1n }, decimal(factor)));
}

/** `percentage % of amountMinor`, rounded half-up once (e.g. retention, a percent milestone, a discount). */
export function percentOfMinor(amountMinor: bigint, percentage: number | string): bigint {
  return roundFraction(times({ n: amountMinor, d: 1n }, percent(percentage)));
}

/** `part` as a percentage of `base`, rounded to two decimals, without trailing zeros ("10", "7.5", "33.33"). */
export function percentageOf(part: bigint, base: bigint): string {
  if (base === 0n) return "0";
  const hundredths = roundFraction({ n: part * 10000n, d: base });
  return (Number(hundredths) / 100).toString();
}
