import { z } from "zod";

/**
 * US-RPT-27 — comparing Profit & Loss across periods and the Balance Sheet
 * across dates. The period maths lives here so the API and the page agree.
 */

export const PL_COMPARE_MODES = ["previous", "last_year", "monthly"] as const;
export type PlCompareMode = (typeof PL_COMPARE_MODES)[number];

export const PL_COMPARE_LABELS: Record<PlCompareMode, string> = {
  previous: "Previous period",
  last_year: "Same period last year",
  monthly: "Each month",
};

/** "Each month" covers at most this many months. */
export const MAX_COMPARE_MONTHS = 24;
export const TOO_MANY_MONTHS = `Choose ${MAX_COMPARE_MONTHS} months or fewer for "Each month".`;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30.");

export const profitAndLossQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    compare: z.enum(PL_COMPARE_MODES, { message: "Choose Previous period, Same period last year or Each month." }).optional(),
    /** US-RPT-35 (D-138). */
    basis: z.enum(["accrual", "cash"], { message: "Choose Accrual or Cash." }).default("accrual"),
  })
  .refine((q) => q.from <= q.to, "Choose a From date on or before the To date.");

export const balanceSheetQuerySchema = z.object({
  asOf: isoDate,
  compareAsOf: isoDate.optional(),
});

export interface ComparePeriod {
  label: string;
  from: string;
  to: string;
}

export interface CompareLine {
  accountId: string;
  code: string;
  name: string;
  /** Minor units, one per column. */
  amounts: string[];
}

export interface ProfitAndLossComparison {
  mode: PlCompareMode;
  /** "previous"/"last_year": [this range, the other]; "monthly": one per month (the report's own totals are the Total column). */
  columns: ComparePeriod[];
  income: CompareLine[];
  expenses: CompareLine[];
  totalIncome: string[];
  totalExpenses: string[];
  netProfit: string[];
}

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return { y, m, d };
};
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addDays = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
/** Moves a date by whole months, keeping the day where the month allows (Jan 31 − 1 month → Dec 31; Mar 31 − 1 month → Feb 28/29). */
const addMonths = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const index = y * 12 + (m - 1) + n;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysIn(ny, nm)));
};
const monthEnd = (y: number, m: number) => fmt(y, m, daysIn(y, m));
const isMonthStart = (s: string) => parse(s).d === 1;
const isMonthEnd = (s: string) => {
  const { y, m, d } = parse(s);
  return d === daysIn(y, m);
};
const monthsBetween = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  return (b.y - a.y) * 12 + (b.m - a.m) + 1;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2026", "Jul – Sep 2026", "Nov 2025 – Jan 2026" for whole months; "Jul 3 – Sep 30, 2026" otherwise. */
export function periodLabel(from: string, to: string): string {
  const a = parse(from);
  const b = parse(to);
  if (isMonthStart(from) && isMonthEnd(to)) {
    if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m - 1]} ${a.y}`;
    return a.y === b.y ? `${MONTHS[a.m - 1]} – ${MONTHS[b.m - 1]} ${b.y}` : `${MONTHS[a.m - 1]} ${a.y} – ${MONTHS[b.m - 1]} ${b.y}`;
  }
  if (from === to) return `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  return a.y === b.y ? `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}` : `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
}

/**
 * The columns to compare. "previous" is the same length immediately before
 * (whole months move by months, so Jul–Sep compares with Apr–Jun);
 * "last_year" is the same dates a year earlier; "monthly" is each month in
 * the range, clipped to it. Throws `TOO_MANY_MONTHS` past 24 months.
 */
export function comparePeriods(from: string, to: string, mode: PlCompareMode): ComparePeriod[] {
  const current = { label: periodLabel(from, to), from, to };
  if (mode === "previous") {
    let prevFrom: string;
    let prevTo: string;
    if (isMonthStart(from) && isMonthEnd(to)) {
      const n = monthsBetween(from, to);
      prevFrom = addMonths(from, -n);
      const p = parse(addMonths(from, -1));
      prevTo = monthEnd(p.y, p.m);
    } else {
      const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
      prevTo = addDays(from, -1);
      prevFrom = addDays(prevTo, -(days - 1));
    }
    return [current, { label: periodLabel(prevFrom, prevTo), from: prevFrom, to: prevTo }];
  }
  if (mode === "last_year") {
    const lyFrom = addMonths(from, -12);
    const lyTo = isMonthEnd(to) ? monthEnd(parse(to).y - 1, parse(to).m) : addMonths(to, -12);
    return [current, { label: periodLabel(lyFrom, lyTo), from: lyFrom, to: lyTo }];
  }
  const n = monthsBetween(from, to);
  if (n > MAX_COMPARE_MONTHS) throw new Error(TOO_MANY_MONTHS);
  const a = parse(from);
  return Array.from({ length: n }, (_, i) => {
    const start = addMonths(fmt(a.y, a.m, 1), i);
    const { y, m } = parse(start);
    const colFrom = i === 0 ? from : start;
    const colTo = i === n - 1 ? to : monthEnd(y, m);
    return { label: `${MONTHS[m - 1]} ${y}`, from: colFrom, to: colTo };
  });
}

/** Change % against the earlier figure, one decimal; null when the earlier figure is zero. */
export function changePercent(current: bigint, previous: bigint): string | null {
  if (previous === 0n) return null;
  const abs = previous < 0n ? -previous : previous;
  const diff = current - previous;
  // Hundredths of a percent, then half away from zero to one decimal.
  const hundredths = (diff * 10000n) / abs;
  const rounded = (hundredths + (diff < 0n ? -5n : 5n)) / 10n;
  const sign = rounded < 0n ? "-" : "";
  const v = rounded < 0n ? -rounded : rounded;
  return `${sign}${v / 10n}.${v % 10n}`;
}

/** The last financial year end on or before a date, given the year's start (Settings › Financial year). */
export function previousYearEnd(asOf: string, start: { month: number; day: number }): string {
  const { y } = parse(asOf);
  const thisYearStart = fmt(y, start.month, Math.min(start.day, daysIn(y, start.month)));
  const yearStart = thisYearStart <= asOf ? thisYearStart : fmt(y - 1, start.month, Math.min(start.day, daysIn(y - 1, start.month)));
  return addDays(yearStart, -1);
}
