import type { ReturnPeriod } from "./tax-profile.ts";
/**
 * US-DASH-14 (D-089) — the dashboard's key figures, each with the last 8
 * weeks and a comparison with last month. Which figures a member gets is
 * decided by the server (US-DASH-17 adds the Staff set).
 */

export type KpiKey = "cash" | "profit" | "receivables" | "overdue" | "pipeline" | "quotes_won" | "payables";

export interface Kpi {
  key: KpiKey;
  label: string;
  /** "money" values are minor units as strings; "count" values are whole numbers as strings. */
  format: "money" | "count";
  value: string;
  /** The same figure a month ago; null when there was no data then. */
  previous: string | null;
  /** 8 points, oldest first, one per week ending today. */
  series: string[];
  /** US-DASH-26 — the basis `profit` was worked out on. */
  basis?: "accrual" | "cash";
  /** Receivables and payables: current and overdue amounts. Overdue: how many invoices. Quotes won: their total. */
  detail?: {
    current?: string;
    overdue?: string;
    count?: number;
    amount?: string;
    /** Payables (US-DASH-21): bills due in the next 7 days, and the most overdue bill. */
    dueSoon?: { count: number; amount: string };
    oldestOverdue?: { number: string; days: number } | null;
  };
}

/** Whether a figure going up is good for the business. */
export const KPI_UP_IS_GOOD: Record<KpiKey, boolean> = {
  cash: true,
  profit: true,
  receivables: false,
  overdue: false,
  pipeline: true,
  quotes_won: true,
  payables: false,
};

export interface KpiChange {
  /** "▲ +8.2% vs last month", "▼ −22.0% vs last month", "No data last month" */
  text: string;
  /** Good for the business, bad, or no comparison. Never shown by colour alone: the arrow and sign say it too. */
  tone: "good" | "bad" | "none";
}

/**
 * The comparison line. Money figures compare as a percentage; counts as a
 * difference ("▲ +2 vs last month"). No figure a month ago (or zero, which
 * has no percentage) reads "No data last month".
 */
export function kpiChange(kpi: Pick<Kpi, "key" | "value" | "previous" | "format">): KpiChange {
  if (kpi.previous === null) return { text: "No data last month", tone: "none" };
  const value = BigInt(kpi.value);
  const previous = BigInt(kpi.previous);
  const diff = value - previous;
  if (diff === 0n) return { text: "No change vs last month", tone: "none" };
  const up = diff > 0n;
  const arrow = up ? "▲" : "▼";
  const tone = up === KPI_UP_IS_GOOD[kpi.key] ? "good" : "bad";
  if (kpi.format === "count") return { text: `${arrow} ${up ? "+" : "−"}${(diff < 0n ? -diff : diff).toString()} vs last month`, tone };
  if (previous === 0n) return { text: "No data last month", tone: "none" };
  const base = previous < 0n ? -previous : previous;
  const tenths = Number(((diff < 0n ? -diff : diff) * 1000n + base / 2n) / base);
  return { text: `${arrow} ${up ? "+" : "−"}${(tenths / 10).toFixed(1)}% vs last month`, tone };
}

/** US-DASH-15 — `GET /reports/money-in-out`: cash received and spent per month. Minor units as strings. */
export interface MoneyInOutReport {
  /** US-DASH-26 (D-179) — "cash": money in and out of bank and cash accounts; "accrual": income and expenses from the ledger. */
  basis?: "accrual" | "cash";
  months: { month: string; in: string; out: string }[];
  totalIn: string;
  totalOut: string;
  net: string;
  /** False until the first payment, bill payment or expense touches cash. */
  hasActivity: boolean;
}

/** US-DASH-20 — `GET /dashboard/retention`: the balance of 1150 Retention Receivable and the three jobs holding the most. Minor units as strings. */
export interface RetentionHeld {
  total: string;
  jobCount: number;
  jobs: { id: string; number: string | null; name: string; held: string }[];
}

/** US-DASH-24 — work done that could be invoiced today. Amounts are minor units. */
export interface UnbilledWork {
  /** Completed milestones not yet invoiced, by job; null when Jobs & field is switched off (D-154). */
  milestones: { count: number; amount: string; jobs: { id: string; name: string; number: string | null; count: number; amount: string }[] } | null;
  /** Approved billable expenses not yet on an invoice, at what they'd invoice for (amount + tax). */
  billableExpenses: { count: number; amount: string };
}

/** US-DASH-25 — tax for the current return period. Amounts are minor units. */
export interface TaxPeriod {
  returnPeriod: ReturnPeriod;
  from: string;
  to: string;
  /** "October 2026", "Oct – Dec 2026". */
  label: string;
  collected: string;
  input: string;
  net: string;
  /** Tax payments recorded for the period; null when none. */
  paid: string | null;
}
