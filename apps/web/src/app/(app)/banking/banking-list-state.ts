import type { MoneyAccount, MoneyAccountKind } from "@spine/shared";
import { t } from "../../../lib/i18n";

export type BankingTab = "active" | "archived";

/** US-BANK-13 (D-210, D-231) — what Banking shows, kept in the address. */
export interface BankingListState {
  tab: BankingTab;
  type: MoneyAccountKind | null;
  /** The Not yet reconciled card: only accounts with entries to reconcile. */
  unreconciled: boolean;
  q: string;
}

const KINDS: readonly MoneyAccountKind[] = ["bank", "cash", "card"];

/** `?tab=archived&type=card&card=unreconciled&q=`. */
export function parseBankingState(params: URLSearchParams): BankingListState {
  const type = params.get("type");
  return {
    tab: params.get("tab") === "archived" ? "archived" : "active",
    type: type && (KINDS as readonly string[]).includes(type) ? (type as MoneyAccountKind) : null,
    unreconciled: params.get("card") === "unreconciled",
    q: params.get("q") ?? "",
  };
}

/** The query for a state; defaults are left out, so `/banking` is every active account. */
export function bankingQuery(state: BankingListState): string {
  const params = new URLSearchParams();
  if (state.tab === "archived") params.set("tab", "archived");
  if (state.type) params.set("type", state.type);
  if (state.unreconciled) params.set("card", "unreconciled");
  if (state.q.trim()) params.set("q", state.q.trim());
  return params.toString();
}

/** The accounts on the tab, of the type, with entries to reconcile when that card is pressed, whose name, bank or last four digits contain the search. */
export function filterAccounts(rows: MoneyAccount[], state: BankingListState): MoneyAccount[] {
  const q = state.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (state.tab === "archived" ? Boolean(r.archivedAt) : !r.archivedAt) &&
      (!state.type || r.kind === state.type) &&
      (!state.unreconciled || (r.unreconciledCount ?? 0) > 0) &&
      (!q || `${r.name} ${r.bankName ?? ""} ${r.last4 ?? ""}`.toLowerCase().includes(q)),
  );
}

/** "HDFC Bank · ••4471"; cash shows its kind only when there's nothing else. */
export function bankLine(account: Pick<MoneyAccount, "bankName" | "last4">): string {
  return [account.bankName, account.last4 ? `••${account.last4}` : null].filter(Boolean).join(" · ");
}

/** The cards' figures over the active accounts. */
export function bankingTotals(rows: MoneyAccount[]) {
  const active = rows.filter((r) => !r.archivedAt);
  const cash = active.filter((r) => r.kind !== "card");
  const cards = active.filter((r) => r.kind === "card");
  const withEntries = active.filter((r) => (r.unreconciledCount ?? 0) > 0);
  const last = active.filter((r) => r.lastReconciledOn).sort((a, b) => b.lastReconciledOn!.localeCompare(a.lastReconciledOn!))[0] ?? null;
  return {
    cash: cash.reduce((sum, r) => sum + BigInt(r.balance ?? "0"), 0n),
    cashLabel: t("banking.list.accountCount", { count: cash.length }),
    owed: cards.reduce((sum, r) => sum + BigInt(r.balance ?? "0"), 0n),
    cardLabel: t("banking.list.cardCount", { count: cards.length }),
    unreconciled: active.reduce((sum, r) => sum + (r.unreconciledCount ?? 0), 0),
    unreconciledLabel: t("banking.list.entriesAcross", { count: withEntries.length }),
    lastReconciled: last,
  };
}
