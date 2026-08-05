/** Integer minor units + currency code. Never a float. */
export interface Money {
  readonly amount: bigint;
  readonly currency: string;
}

export function money(amount: bigint, currency: string): Money {
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function isZero(a: Money): boolean {
  return a.amount === 0n;
}

export function sum(items: readonly Money[], currency: string): Money {
  return items.reduce((acc, item) => add(acc, item), money(0n, currency));
}

/**
 * Rounds a fractional minor-unit amount to the nearest integer, half-up.
 * Used once, at line level — never round a sum, sum the rounded lines.
 */
export function roundHalfUp(amount: number): bigint {
  return BigInt(Math.floor(amount + 0.5));
}
