import type { TableSort } from "@spine/ui";
import { PAYMENT_RANGES, PAYMENT_RANGE_LABELS, rangeBounds, type PaymentRange } from "../payments/payments-list-state";
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type VendorPaymentRow } from "./types";

export { PAYMENT_RANGE_LABELS as VENDOR_PAYMENT_RANGE_LABELS };

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/**
 * US-PUR-51 (D-210, D-229) — what the vendor payments list shows, kept in
 * the address: `?vendor=&method=&range=&q=&sort=&page=`. The dashboard's
 * `?contactId=<vendor>&pay=1` still opens the payment dialog on a vendor.
 */
export interface VendorPaymentsListState {
  q: string;
  vendor: string;
  method: PaymentMethod[];
  range: PaymentRange;
  sort: TableSort | null;
  page: number;
}

export function parseVendorPaymentsState(params: URLSearchParams): VendorPaymentsListState {
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
    // The older `contactId` link still filters to that vendor.
    vendor: params.get("vendor") ?? (params.get("pay") === "1" ? "" : (params.get("contactId") ?? "")),
    method: [...new Set(method)],
    range: (PAYMENT_RANGES as readonly string[]).includes(range ?? "") ? (range as PaymentRange) : "all",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export function vendorPaymentsQuery(state: VendorPaymentsListState): string {
  const params = new URLSearchParams();
  if (state.vendor) params.set("vendor", state.vendor);
  for (const m of state.method) params.append("method", m);
  if (state.range !== "all") params.set("range", state.range);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasVendorPaymentFilters(state: VendorPaymentsListState): boolean {
  return Boolean(state.q.trim() || state.vendor || state.method.length || state.range !== "all");
}

/** Number, reference, vendor and the bills it paid contain the search. */
export function matchesVendorPaymentSearch(p: VendorPaymentRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [p.number ?? "", p.reference ?? "", p.contactName ?? "", ...p.paidTo.map((b) => b.number)].some((f) => f.toLowerCase().includes(needle));
}

export function filterVendorPayments(list: VendorPaymentRow[], state: VendorPaymentsListState, now: Date, yearStart?: { month: number; day: number }): VendorPaymentRow[] {
  const bounds = rangeBounds(state.range, now, yearStart);
  return list.filter((p) => {
    if (state.vendor && p.contactId !== state.vendor) return false;
    if (state.method.length && !state.method.includes(p.method)) return false;
    if (bounds) {
      const day = p.date.slice(0, 10);
      if (day < bounds[0] || day > bounds[1]) return false;
    }
    return matchesVendorPaymentSearch(p, state.q);
  });
}

/** The vendors with a payment, for the Vendor filter. */
export function paymentVendors(list: VendorPaymentRow[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const p of list) if (!seen.has(p.contactId)) seen.set(p.contactId, p.contactName ?? "Unknown vendor");
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** "RTE-3302", "RTE-3302, RTE-3340" or "3 bills". */
export function billsPaidLabel(paidTo: { number: string }[]): string {
  if (paidTo.length === 0) return "—";
  if (paidTo.length <= 2) return paidTo.map((b) => b.number).join(", ");
  return `${paidTo.length} bills`;
}

/**
 * US-PUR-52 — what a payment pays, in a line: "₹48,000.00 pays RTE-3302 in
 * full and ₹8,000.00 of RTE-3340." `lines` are the ticked bills with what
 * goes on each and their balance.
 */
export function paysSentence(lines: { number: string; amount: bigint; balance: bigint }[], money: (v: bigint) => string): string {
  const used = lines.filter((l) => l.amount > 0n);
  if (!used.length) return "";
  const total = used.reduce((s, l) => s + l.amount, 0n);
  const parts = used.map((l) => (l.amount >= l.balance ? `${l.number} in full` : `${money(l.amount)} of ${l.number}`));
  const list = parts.length <= 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${money(total)} pays ${list}.`;
}

/** Spreads an amount over bills oldest due first (the dialog's order), each up to its balance. */
export function spreadOldestFirst(bills: { id: string; balance: bigint }[], amount: bigint): Map<string, bigint> {
  const out = new Map<string, bigint>();
  let left = amount;
  for (const b of bills) {
    if (left <= 0n) break;
    const take = left < b.balance ? left : b.balance;
    out.set(b.id, take);
    left -= take;
  }
  return out;
}
