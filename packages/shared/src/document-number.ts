/**
 * How an issued document's number reads: the prefix, the year token when the
 * series has one, and the value padded to the series' width — "INV-0001",
 * "QUO-2026-0042". The one place this is written, so the numbering service
 * and the onboarding preview (US-ONB-22) can't disagree.
 */
export function formatDocumentNumber(series: { prefix: string; padding: number; yearToken?: string | null }, value: number): string {
  const padded = String(value).padStart(series.padding, "0");
  return series.yearToken ? `${series.prefix}-${series.yearToken}-${padded}` : `${series.prefix}-${padded}`;
}
