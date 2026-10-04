/**
 * US-JOB-23 (D-090, D-122) — the name a job gets from its quote: the
 * first item line followed by " — <customer>", and " (2)", " (3)"… when
 * the same quote is converted again. Quotes have no title field, so the
 * story's "no title" rule applies to every quote.
 */
export function jobNameFromQuote(firstItemName: string | null | undefined, customerName: string | null | undefined, conversion: number): string {
  const item = firstItemName?.trim();
  const customer = customerName?.trim();
  const base = item ? (customer ? `${item} — ${customer}` : item) : customer ? `Work for ${customer}` : "New job";
  return conversion > 1 ? `${base} (${conversion})` : base;
}
