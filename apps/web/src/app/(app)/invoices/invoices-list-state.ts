import type { TableSort } from "@spine/ui";
import { calendarDate, daysUntil } from "../quotes/quotes-list-state";
import type { Invoice } from "./types";
import { t } from "../../../lib/i18n";

/** US-INV-27 — the cards that filter the list. */
export type InvoiceCard = "" | "outstanding" | "overdue" | "due7";

/** US-INV-29 — the one status a row shows. */
export type InvoiceState = "draft" | "due" | "part_paid" | "paid" | "overdue" | "void";
export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  draft: t("invoices.state.draft"),
  due: t("invoices.state.due"),
  part_paid: t("invoices.state.partPaid"),
  paid: t("invoices.state.paid"),
  overdue: t("invoices.state.overdue"),
  void: t("invoices.state.void"),
};
const STATES = Object.keys(INVOICE_STATE_LABELS) as InvoiceState[];

/** US-INV-28 (D-210, D-217) — what the invoices list shows, kept in the address. */
export interface InvoicesListState {
  q: string;
  status: InvoiceState[];
  contact: string;
  card: InvoiceCard;
  sort: TableSort | null;
  page: number;
}

export function parseInvoicesState(params: URLSearchParams): InvoicesListState {
  // `?status=overdue` (the dashboard's link, US-DASH-13) and `?status=a&status=b` both work; the old "issued" reads as due.
  const status = params
    .getAll("status")
    .flatMap((s) => s.split(","))
    .map((s) => (s === "issued" ? "due" : s))
    .filter((s): s is InvoiceState => STATES.includes(s as InvoiceState));
  const card = params.get("card");
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    status: [...new Set(status)],
    contact: params.get("contact") ?? "",
    card: card === "outstanding" || card === "overdue" || card === "due7" ? card : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/invoices` is the whole list, newest first. */
export function invoicesQuery(state: InvoicesListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const s of state.status) params.append("status", s);
  if (state.contact) params.set("contact", state.contact);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasInvoiceFilters(state: InvoicesListState): boolean {
  return Boolean(state.q.trim() || state.status.length || state.contact || state.card);
}

/** Issued (or an opening balance) with something still to pay. */
export function hasBalance(inv: Invoice): boolean {
  return inv.status === "issued" && BigInt(inv.balanceDue) > 0n;
}

/** US-INV-29 — the row's one status. */
export function invoiceState(inv: Invoice): InvoiceState {
  if (inv.status === "draft") return "draft";
  if (inv.status === "void") return "void";
  if (!hasBalance(inv)) return "paid";
  if (inv.isOverdue) return "overdue";
  return inv.paymentStatus === "partially_paid" ? "part_paid" : "due";
}

/** Not overdue, with a balance, due within 7 days (today included). */
export function isDueSoon(inv: Invoice, now: Date): boolean {
  if (!hasBalance(inv) || inv.isOverdue || !inv.dueDate) return false;
  const days = daysUntil(inv.dueDate, now);
  return days >= 0 && days <= 7;
}

export interface MoneySum {
  count: number;
  /** In the business's currency, minor units. */
  amount: bigint;
  /** Some invoices are in another currency, so aren't in `amount`. */
  otherCurrencies: boolean;
}

function sumBalances(list: Invoice[], currency: string): MoneySum {
  let amount = 0n;
  let other = false;
  for (const inv of list) {
    if (inv.currency === currency) amount += BigInt(inv.balanceDue);
    else other = true;
  }
  return { count: list.length, amount, otherCurrencies: other };
}

export interface InvoiceStats {
  outstanding: MoneySum;
  overdue: MoneySum;
  due7: MoneySum;
}

/** US-INV-27 — the balance cards (drafts and voids left out). */
export function invoiceStats(list: Invoice[], currency: string, now: Date): InvoiceStats {
  const open = list.filter(hasBalance);
  return {
    outstanding: sumBalances(open, currency),
    overdue: sumBalances(open.filter((i) => i.isOverdue), currency),
    due7: sumBalances(open.filter((i) => isDueSoon(i, now)), currency),
  };
}

/** A payment as `GET /payments` lists it: when, in what currency, and how much of it went to invoices. */
export interface PaymentForStats {
  date: string;
  currency: string;
  allocatedAmount: string;
}

/** US-INV-27 — "Paid this month": what payments dated this month paid against invoices, and how many payments. */
export function paidThisMonth(payments: PaymentForStats[], currency: string, now: Date): MoneySum {
  let amount = 0n;
  let other = false;
  let count = 0;
  for (const p of payments) {
    const d = new Date(p.date);
    if (d.getUTCFullYear() !== now.getFullYear() || d.getUTCMonth() !== now.getMonth() || BigInt(p.allocatedAmount) <= 0n) continue;
    count += 1;
    if (p.currency === currency) amount += BigInt(p.allocatedAmount);
    else other = true;
  }
  return { count, amount, otherCurrencies: other };
}

/** US-INV-28 — number, customer, a line's name or the job contains the search (case-insensitive). */
export function matchesInvoiceSearch(inv: Invoice, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [inv.number ?? "", inv.contactName ?? "", inv.job?.number ?? "", inv.job?.name ?? "", ...(inv.lineNames ?? [])].some((field) => field.toLowerCase().includes(needle));
}

export function filterInvoices(list: Invoice[], state: InvoicesListState, now: Date): Invoice[] {
  return list.filter((inv) => {
    if (state.contact && inv.contactId !== state.contact) return false;
    if (state.status.length && !state.status.includes(invoiceState(inv))) return false;
    if (state.card === "outstanding" && !hasBalance(inv)) return false;
    if (state.card === "overdue" && !(hasBalance(inv) && inv.isOverdue)) return false;
    if (state.card === "due7" && !isDueSoon(inv, now)) return false;
    return matchesInvoiceSearch(inv, state.q);
  });
}

/** The contacts that have an invoice, for the Contact filter. */
export function invoiceContacts(list: Invoice[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const inv of list) if (!seen.has(inv.contactId)) seen.set(inv.contactId, inv.contactName ?? t("invoices.list.unknownContact"));
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** US-INV-29 — what goes under Due: "in 5 days", "today", "Overdue 6 days", "Paid 2 Oct". */
export function dueNote(inv: Invoice, now: Date, locale?: string): { text: string; tone: "" | "soon" | "over" | "paid" } {
  const state = invoiceState(inv);
  if (state === "void") return { text: "", tone: "" };
  if (state === "paid") return { text: inv.lastPaidAt ? t("invoices.list.paidOn", { date: calendarDate(inv.lastPaidAt, now, locale) }) : t("invoices.list.paid"), tone: "paid" };
  if (!inv.dueDate) return { text: "", tone: "" };
  const days = daysUntil(inv.dueDate, now);
  if (days < 0) return { text: t("invoices.list.overdueDays", { count: -days }), tone: state === "draft" ? "" : "over" };
  if (days === 0) return { text: t("invoices.list.dueToday"), tone: "soon" };
  return { text: t("invoices.list.dueInDays", { count: days }), tone: days <= 7 && state !== "draft" ? "soon" : "" };
}

/** Of the amount due (total less retention), the share paid or credited, 0–100. */
export function paidShare(inv: Invoice): number {
  const due = BigInt(inv.totalAmount) - BigInt(inv.retentionAmount);
  if (due <= 0n) return 0;
  const settled = due - BigInt(inv.balanceDue);
  return Math.max(0, Math.min(100, Number((settled * 100n) / due)));
}
