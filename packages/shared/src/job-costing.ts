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
  /** US-JOB-28 — the owner's estimate, 0–100; null when not set. */
  percentComplete: number | null;
  /** US-JOB-28 — billed % − complete %, in points; null without both. */
  gapPts: number | null;
}

/** US-JOB-28 — the billing-vs-work comparison shows from a gap of this many points. */
export const BILLING_GAP_PTS = 10;

export function billingFigures(contractValue: bigint, billedToDate: bigint, percentComplete: number | null = null): BillingFigures {
  const billedPct = wholePercent(billedToDate, contractValue);
  return {
    contractValue: contractValue.toString(),
    billedToDate: billedToDate.toString(),
    billedPct,
    leftToBill: (contractValue - billedToDate).toString(),
    percentComplete,
    gapPts: billedPct === null || percentComplete === null ? null : Math.round(billedPct - percentComplete),
  };
}

/** "Billing is 15 points behind the work — check for a milestone to invoice." / "Billing is 10 points ahead of the work.", or null under 10 points. */
export function billingGapMessage(gapPts: number | null): string | null {
  if (gapPts === null || Math.abs(gapPts) < BILLING_GAP_PTS) return null;
  return gapPts < 0 ? `Billing is ${-gapPts} points behind the work — check for a milestone to invoice.` : `Billing is ${gapPts} points ahead of the work.`;
}

/** US-JOB-29 (D-128) — "Progress claim 3 · JOB-002", "Progress claim 2 (void)". */
export function progressClaimLabel(claimNo: number, opts: { jobNumber?: string | null; voided?: boolean } = {}): string {
  return `Progress claim ${claimNo}${opts.voided ? " (void)" : ""}${opts.jobNumber ? ` · ${opts.jobNumber}` : ""}`;
}
