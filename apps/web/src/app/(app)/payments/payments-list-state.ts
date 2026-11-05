import type { TableSort } from "@spine/ui";
import type { CustomerRefund } from "@spine/shared";
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentMethod } from "./types";
import { t } from "../../../lib/i18n";

/** US-PAY-22 — how far back the list goes. */
export const PAYMENT_RANGES = ["all", "this_month", "last_month", "90", "fy"] as const;
export type PaymentRange = (typeof PAYMENT_RANGES)[number];
export const PAYMENT_RANGE_LABELS: Record<PaymentRange, string> = {
  all: t("payments.range.all"),
  this_month: t("payments.range.thisMonth"),
  last_month: t("payments.range.lastMonth"),
  "90": t("payments.range.last90"),
  fy: t("payments.range.fy"),
};

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/** US-PAY-22 (D-210, D-221) — what the payments list shows, kept in the address. */
export interface PaymentsListState {
  q: string;
  contact: string;
  method: PaymentMethod[];
  range: PaymentRange;
  /** The "Credit to use" card. */
  card: "" | "credit";
  sort: TableSort | null;
  page: number;
}

export function parsePaymentsState(params: URLSearchParams): PaymentsListState {
  const method = params
    .getAll("method")
    .flatMap((s) => s.split(","))
    .filter((s): s is PaymentMethod => METHODS.includes(s as PaymentMethod));
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const range = params.get("range");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    contact: params.get("contact") ?? "",
    method: [...new Set(method)],
    range: (PAYMENT_RANGES as readonly string[]).includes(range ?? "") ? (range as PaymentRange) : "all",
    card: params.get("card") === "credit" ? "credit" : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/payments` is every payment, newest first. */
export function paymentsQuery(state: PaymentsListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.contact) params.set("contact", state.contact);
  for (const m of state.method) params.append("method", m);
  if (state.range !== "all") params.set("range", state.range);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasPaymentFilters(state: PaymentsListState): boolean {
  return Boolean(state.q.trim() || state.contact || state.method.length || state.card || state.range !== "all");
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `[from, to]` as `YYYY-MM-DD` (inclusive) for a range, or null for all time. */
export function rangeBounds(range: PaymentRange, now: Date, yearStart: { month: number; day: number } = { month: 1, day: 1 }): [string, string] | null {
  const today = ymd(now);
  switch (range) {
    case "all":
      return null;
    case "this_month":
      return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), today];
    case "last_month":
      return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))];
    case "90":
      return [ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)), today];
    case "fy": {
      const thisYear = new Date(now.getFullYear(), yearStart.month - 1, yearStart.day);
      const start = thisYear <= now ? thisYear : new Date(now.getFullYear() - 1, yearStart.month - 1, yearStart.day);
      return [ymd(start), today];
    }
  }
}

const big = (v: string | null | undefined) => BigInt(v ?? "0");

/** US-PAY-22 — the receipt number, reference, customer and the invoices it was applied to contain the search. */
export function matchesPaymentSearch(p: Payment, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [p.number ?? "", p.reference ?? "", p.contactName ?? "", ...(p.appliedTo ?? []).map((a) => a.number ?? "")].some((f) => f.toLowerCase().includes(needle));
}

export function filterPayments(list: Payment[], state: PaymentsListState, now: Date, yearStart?: { month: number; day: number }): Payment[] {
  const bounds = rangeBounds(state.range, now, yearStart);
  return list.filter((p) => {
    if (state.contact && p.contactId !== state.contact) return false;
    if (state.method.length && !state.method.includes(p.method)) return false;
    if (state.card === "credit" && big(p.unallocatedAmount) <= 0n) return false;
    if (bounds) {
      const day = p.date.slice(0, 10);
      if (day < bounds[0] || day > bounds[1]) return false;
    }
    return matchesPaymentSearch(p, state.q);
  });
}

export interface MoneySum {
  count: number;
  /** In the business's currency, minor units. */
  amount: bigint;
  otherCurrencies: boolean;
}

const inMonth = (iso: string | null | undefined, now: Date) => {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day.slice(0, 7) === `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

/** US-PAY-21 — "Received this month" and "Credit to use" (`count` is how many customers). */
export function paymentStats(list: Payment[], currency: string, now: Date): { received: MoneySum; credit: MoneySum } {
  const received: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  const credit: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  const customers = new Set<string>();
  for (const p of list) {
    if (inMonth(p.date, now)) {
      received.count += 1;
      if (p.currency === currency) received.amount += big(p.amount);
      else received.otherCurrencies = true;
    }
    const left = big(p.unallocatedAmount);
    if (left > 0n) {
      customers.add(p.contactId);
      if (p.currency === currency) credit.amount += left;
      else credit.otherCurrencies = true;
    }
  }
  credit.count = customers.size;
  return { received, credit };
}

/** "Refunded this month" — refunds of payment credit dated this month, not deleted. */
export function paymentRefundsThisMonth(refunds: CustomerRefund[], currency: string, now: Date): MoneySum {
  const sum: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  for (const r of refunds) {
    if (r.source.kind !== "payment" || r.deletedAt || !inMonth(r.date, now)) continue;
    sum.count += 1;
    if (r.currency === currency) sum.amount += big(r.amount);
    else sum.otherCurrencies = true;
  }
  return sum;
}

/** The contacts that have a payment, for the Contact filter. */
export function paymentContacts(list: Payment[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const p of list) if (!seen.has(p.contactId)) seen.set(p.contactId, p.contactName ?? t("payments.list.unknownContact"));
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}
