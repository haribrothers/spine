import { type Fraction, ONE, ZERO, decimal, dividedBy, percent, plus, roundFraction, times } from "../money/decimal.ts";
import { type Money, money } from "../money/money.ts";

export interface TaxRate {
  readonly id: string;
  readonly name: string;
  /** The rate as a percentage, e.g. 8.875 for 8.875% (exact, never divided by 100 in floating point). */
  readonly percent: number | string;
  readonly isCompound: boolean;
}

export interface LineTaxResult {
  readonly taxableAmount: Money;
  readonly taxAmount: Money;
  readonly total: Money;
}

/**
 * Computes tax for a single line, exactly (D-004, D-118). Rounding happens
 * once here, half-up — document totals must sum already-rounded lines,
 * never round a sum. Compound rates apply to the base plus the tax before
 * them; for tax-inclusive prices the base is backed out of the amount.
 */
export function computeLineTax(lineAmount: Money, rates: readonly TaxRate[], inclusive: boolean): LineTaxResult {
  const amount: Fraction = { n: lineAmount.amount, d: 1n };
  const simpleTotal = rates.filter((r) => !r.isCompound).reduce((sum, r) => plus(sum, percent(r.percent)), ZERO);
  const base = inclusive ? dividedBy(amount, plus(ONE, simpleTotal)) : amount;

  let tax = ZERO;
  for (const rate of rates) {
    const taxable = rate.isCompound ? plus(base, tax) : base;
    tax = plus(tax, times(taxable, percent(rate.percent)));
  }

  const taxAmount = roundFraction(tax);
  const taxableAmount = inclusive ? roundFraction(base) : lineAmount.amount;
  const total = inclusive ? lineAmount.amount : lineAmount.amount + taxAmount;

  return {
    taxableAmount: money(taxableAmount, lineAmount.currency),
    taxAmount: money(taxAmount, lineAmount.currency),
    total: money(total, lineAmount.currency),
  };
}

export interface DocumentLineInput {
  readonly quantity: number | string;
  /** Minor units. */
  readonly unitPriceAmount: bigint;
  readonly discountPercentage?: number | string;
  readonly currency: string;
  readonly rates: readonly TaxRate[];
  readonly inclusive: boolean;
}

export interface DocumentLineResult {
  /** quantity × unit price, rounded once. */
  readonly grossAmount: bigint;
  readonly discountAmount: bigint;
  /** gross − discount: what tax is charged on (or backed out of). */
  readonly netAmount: bigint;
  readonly tax: LineTaxResult;
}

/**
 * One line of a quote, invoice, credit note or vendor bill — the only place
 * line maths happens (03-monorepo rule 6). Exact throughout; each figure is
 * rounded once, half-up.
 */
export function computeDocumentLine(input: DocumentLineInput): DocumentLineResult {
  const grossAmount = roundFraction(times(decimal(input.quantity), { n: input.unitPriceAmount, d: 1n }));
  const discountAmount = roundFraction(times({ n: grossAmount, d: 1n }, percent(input.discountPercentage ?? 0)));
  const netAmount = grossAmount - discountAmount;
  return {
    grossAmount,
    discountAmount,
    netAmount,
    tax: computeLineTax(money(netAmount, input.currency), input.rates, input.inclusive),
  };
}
