import type { TableSort } from "@spine/ui";
import { formatMoney } from "../../../lib/money";
import { t } from "../../../lib/i18n";
import type { VendorCredit } from "./types";

/**
 * US-PUR-37/38 (D-226) — where a vendor credit stands, in words. "Partly
 * used" is worked out from what's left against the total, never stored;
 * the API's status stays draft | open | used | void.
 */
export type CreditState = "draft" | "open" | "partly" | "used" | "void";

export const CREDIT_STATE_LABELS: Record<CreditState, string> = {
  draft: t("vendorCredits.creditStates.draft"),
  open: t("vendorCredits.creditStates.open"),
  partly: t("vendorCredits.creditStates.partly"),
  used: t("vendorCredits.creditStates.used"),
  void: t("vendorCredits.creditStates.void"),
};

export const CREDIT_STATE_CLASS: Record<CreditState, string> = {
  draft: "bg-draft-bg text-draft",
  open: "bg-info-bg text-primary",
  partly: "bg-due-soon-bg text-due-soon",
  used: "bg-paid-bg text-paid",
  void: "bg-draft-bg text-draft line-through",
};

type CreditFigures = Pick<VendorCredit, "status" | "totalAmount" | "balanceAmount">;

export function creditState(credit: CreditFigures): CreditState {
  if (credit.status === "draft" || credit.status === "void") return credit.status;
  const left = BigInt(credit.balanceAmount);
  if (left <= 0n) return "used";
  return left < BigInt(credit.totalAmount) ? "partly" : "open";
}

/** Whether a recorded credit still has some left to apply or refund. */
export function hasCreditLeft(credit: CreditFigures): boolean {
  return credit.status === "open" && BigInt(credit.balanceAmount) > 0n;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** US-PUR-38 — how old a credit counts as "unused" for the card: credit left, dated this many days ago or more. */
export const UNUSED_DAYS = 60;

function isUnused(credit: VendorCredit, today: Date): boolean {
  if (!hasCreditLeft(credit)) return false;
  const dated = new Date(`${credit.date.slice(0, 10)}T00:00:00`);
  return (startOfDay(today).getTime() - dated.getTime()) / DAY_MS >= UNUSED_DAYS;
}

// ---------- The list (US-PUR-38, D-210) ----------

export const CREDIT_STATES: CreditState[] = ["draft", "open", "partly", "used", "void"];
export type CreditCard = "" | "drafts" | "partly" | "unused";

export interface VendorCreditsListState {
  states: CreditState[];
  vendor: string;
  job: string;
  card: CreditCard;
  q: string;
  sort: TableSort | null;
  page: number;
}

/** `?state=open,partly&vendor=&job=&card=&q=&sort=key.dir&page=`. */
export function parseVendorCreditsState(params: URLSearchParams): VendorCreditsListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const card = params.get("card");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    states: [...new Set((params.get("state") ?? "").split(",").filter((s): s is CreditState => (CREDIT_STATES as string[]).includes(s)))],
    vendor: params.get("vendor") ?? "",
    job: params.get("job") ?? "",
    card: card === "drafts" || card === "partly" || card === "unused" ? card : "",
    q: params.get("q") ?? "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out. */
export function vendorCreditsQuery(state: VendorCreditsListState): string {
  const params = new URLSearchParams();
  if (state.states.length) params.set("state", state.states.join(","));
  if (state.vendor) params.set("vendor", state.vendor);
  if (state.job) params.set("job", state.job);
  if (state.card) params.set("card", state.card);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasCreditFilters(state: VendorCreditsListState): boolean {
  return Boolean(state.states.length || state.vendor || state.job || state.card || state.q.trim());
}

function inCard(credit: VendorCredit, card: CreditCard, today: Date): boolean {
  if (!card) return true;
  if (card === "drafts") return credit.status === "draft";
  if (card === "partly") return creditState(credit) === "partly";
  return isUnused(credit, today);
}

/** The credits on screen: state, vendor, job, card and search (number, their number, vendor or bill). */
export function filterCredits(credits: VendorCredit[], state: VendorCreditsListState, today: Date): VendorCredit[] {
  const needle = state.q.trim().toLowerCase();
  return credits.filter((c) => {
    if (state.states.length && !state.states.includes(creditState(c))) return false;
    if (state.vendor && c.contactId !== state.vendor) return false;
    if (state.job && c.jobId !== state.job) return false;
    if (!inCard(c, state.card, today)) return false;
    if (!needle) return true;
    return [c.number ?? "", c.vendorReference ?? "", c.contactName ?? "", c.billNumber ?? ""].some((f) => f.toLowerCase().includes(needle));
  });
}

export interface CreditStats {
  toUse: { amount: bigint; count: number };
  drafts: { amount: bigint; count: number };
  partly: { amount: bigint; count: number };
  unused: { amount: bigint; count: number };
}

/** US-PUR-38 — the cards, in the business's currency (credits in another currency aren't added in). */
export function creditStats(credits: VendorCredit[], currency: string, today: Date): CreditStats {
  const stats: CreditStats = { toUse: { amount: 0n, count: 0 }, drafts: { amount: 0n, count: 0 }, partly: { amount: 0n, count: 0 }, unused: { amount: 0n, count: 0 } };
  for (const c of credits) {
    if (c.currency !== currency) continue;
    if (c.status === "draft") {
      stats.drafts.count += 1;
      stats.drafts.amount += BigInt(c.totalAmount);
      continue;
    }
    if (!hasCreditLeft(c)) continue;
    const left = BigInt(c.balanceAmount);
    stats.toUse.count += 1;
    stats.toUse.amount += left;
    if (creditState(c) === "partly") {
      stats.partly.count += 1;
      stats.partly.amount += left;
    }
    if (isUnused(c, today)) {
      stats.unused.count += 1;
      stats.unused.amount += left;
    }
  }
  return stats;
}

/** What's been applied to bills and refunded (refunds not deleted). */
export function creditUse(credit: Pick<VendorCredit, "allocations" | "refunds">): { applied: bigint; refunded: bigint } {
  return {
    applied: (credit.allocations ?? []).reduce((sum, a) => sum + BigInt(a.amount), 0n),
    refunded: (credit.refunds ?? []).filter((r) => !r.deletedAt).reduce((sum, r) => sum + BigInt(r.amount), 0n),
  };
}

/** US-PUR-37 — the toast when a credit is recorded, from its page, a row or "Save and record". */
export function creditRecordedToast(credit: Pick<VendorCredit, "number" | "totalAmount" | "currency" | "contactName">): [string, string] {
  return [
    t("vendorCredits.state.recordedToastTitle", { number: credit.number ?? t("vendorCredits.state.vendorCredit") }),
    t("vendorCredits.state.recordedToastDescription", { amount: formatMoney(BigInt(credit.totalAmount), credit.currency), vendor: credit.contactName ?? t("vendorCredits.state.theVendor") }),
  ];
}

/**
 * US-PUR-40 — the amounts the apply dialog starts with: the bill the credit
 * was raised against first, then the rest oldest first, each up to its
 * balance until the credit runs out.
 */
export function fillBills<B extends { id: string; date: string; balanceDue?: string | null }>(bills: B[], left: bigint, againstBillId: string | null): { ordered: B[]; amounts: Record<string, bigint> } {
  const ordered = bills
    .filter((b) => BigInt(b.balanceDue ?? "0") > 0n)
    .sort((a, b) => (a.id === againstBillId ? -1 : b.id === againstBillId ? 1 : a.date.localeCompare(b.date)));
  const amounts: Record<string, bigint> = {};
  let remaining = left;
  for (const b of ordered) {
    const due = BigInt(b.balanceDue ?? "0");
    amounts[b.id] = remaining < due ? remaining : due;
    remaining -= amounts[b.id]!;
  }
  return { ordered, amounts };
}
