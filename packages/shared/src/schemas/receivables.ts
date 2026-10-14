/** US-PAY-29 (D-224) — the ages Receivables can show: every one, everything overdue, or one bucket. */
export const RECEIVABLES_AGES = ["current", "overdue", "0-30", "31-60", "61-90", "90+"] as const;
export type ReceivablesAge = (typeof RECEIVABLES_AGES)[number];

export const RECEIVABLES_AGE_LABELS: Record<ReceivablesAge, string> = {
  current: "Current",
  overdue: "Overdue",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

/** An age from the address (`?age=`), or the dashboard's `?overdue=1`; anything else is every age. */
export function parseReceivablesAge(age: string | null | undefined, overdue?: string | null): ReceivablesAge | null {
  if (age && (RECEIVABLES_AGES as readonly string[]).includes(age)) return age as ReceivablesAge;
  return overdue === "1" ? "overdue" : null;
}

/** Whether an invoice's bucket ("current", "0-30" …) is in the chosen age; no age keeps everything. */
export function inReceivablesAge(bucket: string, age: ReceivablesAge | null): boolean {
  if (!age) return true;
  if (age === "overdue") return bucket !== "current";
  return bucket === age;
}
