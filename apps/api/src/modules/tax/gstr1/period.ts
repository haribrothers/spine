import { BadRequestException } from "@nestjs/common";

export interface Gstr1Period {
  kind: "monthly" | "quarterly";
  /** First and last day, inclusive (YYYY-MM-DD). */
  from: string;
  to: string;
  /** The return period the portal expects: MMYYYY of the period's last month (a quarterly filer files for the quarter's last month). */
  fp: string;
  /** "September 2026", "Jul – Sep 2026". */
  label: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const PERIOD_MESSAGE = "Choose a month (YYYY-MM) or a quarter (YYYY-Q1 to YYYY-Q4).";

/**
 * US-TAX-16 — `2026-09` is September 2026; `2026-Q3` is the calendar
 * quarter July to September 2026 (Q1 is January to March), shown as
 * "Jul – Sep 2026" so it never reads as a financial-year quarter.
 */
export function parseGstr1Period(value: unknown): Gstr1Period {
  const text = typeof value === "string" ? value.trim() : "";
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text);
  if (month) {
    const year = Number(month[1]);
    const m = Number(month[2]);
    return { kind: "monthly", from: `${year}-${pad(m)}-01`, to: `${year}-${pad(m)}-${pad(lastDay(year, m))}`, fp: `${pad(m)}${year}`, label: `${MONTHS[m - 1]} ${year}` };
  }
  const quarter = /^(\d{4})-Q([1-4])$/i.exec(text);
  if (quarter) {
    const year = Number(quarter[1]);
    const first = (Number(quarter[2]) - 1) * 3 + 1;
    const last = first + 2;
    return {
      kind: "quarterly",
      from: `${year}-${pad(first)}-01`,
      to: `${year}-${pad(last)}-${pad(lastDay(year, last))}`,
      fp: `${pad(last)}${year}`,
      label: `${MONTHS[first - 1]!.slice(0, 3)} – ${MONTHS[last - 1]!.slice(0, 3)} ${year}`,
    };
  }
  throw new BadRequestException(PERIOD_MESSAGE);
}
