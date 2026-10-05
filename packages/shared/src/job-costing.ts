/**
 * US-JOB-25 (D-125) — a job's cost against its budget. "Near" at 80% used
 * or more, "over" once cost passes the budget. Used by the Costing tab, the
 * Jobs list and Job Profitability so they always agree.
 */
export const BUDGET_NEAR_PCT = 80;

export type BudgetState = "none" | "ok" | "near" | "over";

export interface BudgetFigures {
  /** Minor units as strings; null without a budget. */
  amount: string | null;
  spent: string;
  remaining: string | null;
  /** Whole percent, rounded half up; null without a budget (or a zero budget). */
  usedPct: number | null;
  state: BudgetState;
}

/** Percent of `part` in `whole`, rounded half up to a whole number; null when `whole` is 0. */
export function wholePercent(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  const negative = part < 0n !== whole < 0n;
  const p = part < 0n ? -part : part;
  const w = whole < 0n ? -whole : whole;
  const rounded = Number((p * 200n + w) / (2n * w));
  return negative ? -rounded : rounded;
}

export function budgetFigures(budget: bigint | null, spent: bigint): BudgetFigures {
  if (budget === null) return { amount: null, spent: spent.toString(), remaining: null, usedPct: null, state: "none" };
  const usedPct = wholePercent(spent, budget);
  const state: BudgetState = spent > budget ? "over" : usedPct !== null && usedPct >= BUDGET_NEAR_PCT ? "near" : "ok";
  return { amount: budget.toString(), spent: spent.toString(), remaining: (budget - spent).toString(), usedPct, state };
}

/** The Jobs list's "Budget used" text: "78%", "Nearing · 85%", "Over · 104%", or "—". */
export function budgetUsedLabel(state: BudgetState | undefined, usedPct: number | null | undefined): string {
  if (!state || state === "none") return "—";
  const pct = usedPct === null || usedPct === undefined ? "" : `${usedPct}%`;
  if (state === "over") return pct ? `Over · ${pct}` : "Over";
  if (state === "near") return `Nearing · ${pct}`;
  return pct || "—";
}

/**
 * US-JOB-27 (D-127) — how much of the contract has been billed. Billed to
 * date is gross (tax included, before retention); the contract value is
 * the tax-inclusive quote total plus applied variations.
 */
export interface BillingFigures {
  contractValue: string;
  billedToDate: string;
  /** Whole percent of the contract; null for a zero contract. */
  billedPct: number | null;
  /** Negative when billed over the contract. */
  leftToBill: string;
}

export function billingFigures(contractValue: bigint, billedToDate: bigint): BillingFigures {
  return {
    contractValue: contractValue.toString(),
    billedToDate: billedToDate.toString(),
    billedPct: wholePercent(billedToDate, contractValue),
    leftToBill: (contractValue - billedToDate).toString(),
  };
}
