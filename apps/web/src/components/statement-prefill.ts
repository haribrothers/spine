/**
 * US-BANK-09 — a statement line's figures, fixed in the form that records
 * the missing entry for it: amount (positive), date, the account and its
 * reference. The form can't change them, so the new entry matches the line.
 */
export interface StatementPrefill {
  amount: bigint;
  /** `YYYY-MM-DD`. */
  date: string;
  moneyAccountId: string;
  moneyAccountName: string;
  reference: string | null;
  description: string;
}

/** The line's date as a local-midnight Date for a DatePicker. */
export function prefillDate(prefill: StatementPrefill): Date {
  return new Date(`${prefill.date}T00:00:00`);
}

/** A picked date as `YYYY-MM-DD` in local time (never via UTC, which can shift the day). */
export function localIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
