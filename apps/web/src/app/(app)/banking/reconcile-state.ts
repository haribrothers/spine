import type { AiBankSuggestion, ReconciliationEntry, StatementLine } from "@spine/shared";
import { t } from "../../../lib/i18n";

/** US-BANK-16 (D-231) — the statement panel's tabs. */
export type LineTab = "todo" | "suggested" | "matched" | "excluded";

/** Which tab a line is under: unmatched lines are To do, and those with a suggestion are Suggested too. */
export function lineTab(line: Pick<StatementLine, "status">, suggested: boolean): LineTab[] {
  if (line.status === "matched") return ["matched"];
  if (line.status === "excluded") return ["excluded"];
  return suggested ? ["todo", "suggested"] : ["todo"];
}

const digits = (s: string) => s.replace(/[^0-9]/g, "");

/** Lines whose description or reference contains the search, or whose amount does ("2400" finds 2,400.00). */
export function searchLines<T extends Pick<StatementLine, "description" | "reference" | "amount">>(lines: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return lines;
  const qDigits = digits(q);
  return lines.filter((l) => `${l.description} ${l.reference ?? ""}`.toLowerCase().includes(q) || (qDigits.length > 0 && digits((BigInt(l.amount) < 0n ? -BigInt(l.amount) : BigInt(l.amount)).toString()).includes(qDigits)));
}

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/**
 * The entries panel's order while a line is selected: AI's suggestion first
 * (US-AI-14, marked), then the same amount (marked), then the nearest dates.
 * Without a selection, as they come. The search matches what, contact or
 * reference.
 */
export function orderEntries(
  entries: ReconciliationEntry[],
  selected: Pick<StatementLine, "amount" | "date"> | null,
  query: string,
  aiFirst: readonly string[] = [],
): { entry: ReconciliationEntry; sameAmount: boolean; ai: boolean }[] {
  const q = query.trim().toLowerCase();
  const kept = entries.filter((e) => !q || `${e.what} ${e.contact?.name ?? ""} ${e.reference ?? ""}`.toLowerCase().includes(q));
  if (!selected) return kept.map((entry) => ({ entry, sameAmount: false, ai: false }));
  const target = BigInt(selected.amount);
  const aiRank = (id: string) => (aiFirst.includes(id) ? aiFirst.indexOf(id) : Infinity);
  return kept
    .map((entry) => ({ entry, sameAmount: BigInt(entry.amount) === target, gap: Math.abs(day(entry.date) - day(selected.date)), rank: aiRank(entry.journalLineId) }))
    .sort((a, b) => (a.rank === b.rank ? 0 : a.rank - b.rank) || Number(b.sameAmount) - Number(a.sameAmount) || a.gap - b.gap)
    .map(({ entry, sameAmount, rank }) => ({ entry, sameAmount, ai: rank === 0 }));
}

/** US-AI-14 — what AI suggests creating: "Bank charges · HDFC Bank", "Customer payment · Maple Ridge". */
export function aiCreateLabel(create: NonNullable<AiBankSuggestion["create"]>): string {
  const what = create.kind === "money" ? create.accountName : create.kind === "payment" ? t("banking.reconcile.aiCreateCustomerPayment") : t("banking.reconcile.aiCreateVendorPayment");
  return [what, create.contactName].filter(Boolean).join(" · ");
}
