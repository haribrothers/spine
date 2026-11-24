/** US-PUR-59 (D-230) — the ages Payables can show: Receivables' ages plus "Due in 7 days" (not yet overdue, due within a week). */
export const PAYABLES_AGES = ["overdue", "due7", "current", "0-30", "31-60", "61-90", "90+"] as const;
export type PayablesAge = (typeof PAYABLES_AGES)[number];

export const PAYABLES_AGE_LABELS: Record<PayablesAge, string> = {
  overdue: "Overdue",
  due7: "Due in 7 days",
  current: "Current",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

export function isPayablesAge(age: string): age is PayablesAge {
  return (PAYABLES_AGES as readonly string[]).includes(age);
}

/** An age from the address (`?age=`), or the dashboard's `?overdue=1`; anything else is every age. */
export function parsePayablesAge(age: string | null | undefined, overdue?: string | null): PayablesAge | null {
  if (age && isPayablesAge(age)) return age;
  return overdue === "1" ? "overdue" : null;
}

/** Whether a bill is in the chosen age; no age keeps everything. A bill with no due date is never due soon. */
export function inPayablesAge(bill: { bucket: string; daysOverdue: number; dueDate: string | null }, age: PayablesAge | null): boolean {
  if (!age) return true;
  if (age === "overdue") return bill.bucket !== "current";
  if (age === "due7") return bill.dueDate !== null && bill.daysOverdue <= 0 && bill.daysOverdue >= -7;
  return bill.bucket === age;
}
