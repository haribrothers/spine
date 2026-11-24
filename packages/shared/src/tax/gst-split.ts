import type { TaxType } from "./tax-types.ts";

/** One tax a line carries, as a GST document prints it. */
export interface TaxComponent {
  taxType: TaxType;
  /** Percentage, e.g. 9. */
  rate: number;
  /** Minor units. */
  amount: bigint;
}

/**
 * US-TAX-15 — splits a line's tax (already rounded once, D-004) across the
 * rates it was charged at, in proportion to each rate, so the parts always
 * add up to the line's tax: CGST 9% + SGST 9% halves it; a cess takes its
 * share. Largest remainders get the leftover minor units, ties to the
 * first rate.
 */
export function splitLineTax(lineTax: bigint, rates: readonly { taxType: TaxType; rate: number }[]): TaxComponent[] {
  const positive = rates.filter((r) => r.rate > 0);
  if (lineTax === 0n || positive.length === 0) return [];
  // Rates to 4 decimal places, as integers, so the split is exact.
  const weights = positive.map((r) => BigInt(Math.round(r.rate * 10000)));
  const total = weights.reduce((a, b) => a + b, 0n);
  const sign = lineTax < 0n ? -1n : 1n;
  const abs = lineTax * sign;
  const shares = weights.map((w) => (abs * w) / total);
  let left = abs - shares.reduce((a, b) => a + b, 0n);
  const byRemainder = weights.map((w, i) => ({ i, rem: (abs * w) % total })).sort((a, b) => (b.rem === a.rem ? a.i - b.i : b.rem > a.rem ? 1 : -1));
  for (const { i } of byRemainder) {
    if (left === 0n) break;
    shares[i]! += 1n;
    left -= 1n;
  }
  return positive.map((r, i) => ({ taxType: r.taxType, rate: r.rate, amount: shares[i]! * sign }));
}

/**
 * The GST rates a line without named rates was charged at: half CGST and
 * half SGST within the state, else IGST.
 */
export function legacyGstRates(rate: number, supplyType: "intra" | "inter" | "export" | null): { taxType: TaxType; rate: number }[] {
  if (rate <= 0) return [];
  return supplyType === "intra" ? [{ taxType: "cgst", rate: rate / 2 }, { taxType: "sgst", rate: rate / 2 }] : [{ taxType: "igst", rate }];
}
