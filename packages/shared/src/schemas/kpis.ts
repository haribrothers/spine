/**
 * US-DASH-14 (D-089) — the dashboard's key figures, each with the last 8
 * weeks and a comparison with last month. Which figures a member gets is
 * decided by the server (US-DASH-17 adds the Staff set).
 */

export type KpiKey = "cash" | "profit" | "receivables" | "overdue" | "pipeline" | "quotes_won";

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
  /** Receivables: current and overdue amounts. Overdue: how many invoices. Quotes won: their total. */
  detail?: { current?: string; overdue?: string; count?: number; amount?: string };
}

/** Whether a figure going up is good for the business. */
export const KPI_UP_IS_GOOD: Record<KpiKey, boolean> = {
  cash: true,
  profit: true,
  receivables: false,
  overdue: false,
  pipeline: true,
  quotes_won: true,
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
