/** US-INV-33 — the builder's due-date quick picks: on receipt, +15, +30 and +60 days. */
export const DUE_PICKS = [0, 15, 30, 60];

/** A date at local midnight, `days` after another (or today). */
export function daysAfter(base: Date | undefined, days: number, today = new Date()): Date {
  const from = base ?? today;
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

/** US-INV-33 — which quick pick (if any) the due date is, counted from the issue date (today when blank). */
export function pickedDueDays(issueDate: Date | undefined, dueDate: Date | undefined, picks: number[] = DUE_PICKS, today = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  return picks.find((n) => daysAfter(issueDate, n, today).getTime() === due) ?? null;
}
