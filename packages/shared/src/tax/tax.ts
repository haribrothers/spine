import { type Money, money, roundHalfUp } from "../money/money";

export interface TaxRate {
  readonly id: string;
  readonly name: string;
  /** e.g. 0.15 for 15% */
  readonly rate: number;
  readonly isCompound: boolean;
}

export interface LineTaxResult {
  readonly taxableAmount: Money;
  readonly taxAmount: Money;
  readonly total: Money;
}

/**
 * Computes tax for a single line. Rounding happens once here, half-up —
 * document totals must sum already-rounded lines, never round a sum.
 */
export function computeLineTax(
  lineAmount: Money,
  rates: readonly TaxRate[],
  inclusive: boolean,
): LineTaxResult {
  const base = Number(lineAmount.amount);
  const compoundBase = inclusive ? base / (1 + totalRate(rates)) : base;
  let taxTotal = 0;

  for (const rate of rates) {
    const taxableBase = rate.isCompound ? compoundBase + taxTotal : compoundBase;
    taxTotal += taxableBase * rate.rate;
  }

  const taxAmount = roundHalfUp(taxTotal);
  const taxableAmount = inclusive
    ? roundHalfUp(compoundBase)
    : lineAmount.amount;
  const total = inclusive ? lineAmount.amount : lineAmount.amount + taxAmount;

  return {
    taxableAmount: money(taxableAmount, lineAmount.currency),
    taxAmount: money(taxAmount, lineAmount.currency),
    total: money(total, lineAmount.currency),
  };
}

function totalRate(rates: readonly TaxRate[]): number {
  return rates.filter((r) => !r.isCompound).reduce((sum, r) => sum + r.rate, 0);
}
