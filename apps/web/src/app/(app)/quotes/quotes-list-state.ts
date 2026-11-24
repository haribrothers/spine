import type { TableSort } from "@spine/ui";
import type { Quote } from "./types";
import { t } from "../../../lib/i18n";

/** US-QUO-27 — the cards that filter the list. */
export type QuoteCard = "" | "open" | "expiring" | "won";

/** US-QUO-28 (D-210, D-214) — what the quotes list shows, kept in the address. */
export interface QuotesListState {
  q: string;
  /** draft, sent, accepted, rejected and/or expired; empty means every status. */
  status: string[];
  contact: string;
  card: QuoteCard;
  sort: TableSort | null;
  page: number;
}

const STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];
const DAY = 24 * 60 * 60 * 1000;

export function parseQuotesState(params: URLSearchParams): QuotesListState {
  // `?status=accepted,sent` (the dashboard's link) and `?status=a&status=b` both work.
  const status = params
    .getAll("status")
    .flatMap((s) => s.split(","))
    .filter((s) => STATUSES.includes(s));
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
    status,
    contact: params.get("contact") ?? "",
    card: card === "open" || card === "expiring" || card === "won" ? card : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/quotes` is the whole list, newest first. */
export function quotesQuery(state: QuotesListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const s of state.status) params.append("status", s);
  if (state.contact) params.set("contact", state.contact);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasQuoteFilters(state: QuotesListState): boolean {
  return Boolean(state.q.trim() || state.status.length || state.contact || state.card);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole days from today to a date (negative when it's past). */
export function daysUntil(iso: string, now: Date): number {
  const date = new Date(iso);
  return Math.round((startOfDay(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) - startOfDay(now)) / DAY);
}

/** The newest version of each quote (one row per quote in the list). */
export function latestVersions(quotes: Quote[]): Quote[] {
  const byRoot = new Map<string, Quote>();
  for (const q of quotes) {
    const current = byRoot.get(q.rootQuoteId);
    if (!current || q.version > current.version) byRoot.set(q.rootQuoteId, q);
  }
  return [...byRoot.values()];
}

/** Sent, not expired and not revised. */
export function isOpen(q: Quote): boolean {
  return q.status === "sent" && !q.isExpired && !q.isSuperseded;
}

/** Open, with its validity ending within 7 days (today included). */
export function isExpiringSoon(q: Quote, now: Date): boolean {
  if (!isOpen(q) || !q.validUntil) return false;
  const days = daysUntil(q.validUntil, now);
  return days >= 0 && days <= 7;
}

function answeredAt(q: Quote): Date {
  return new Date(q.respondedAt ?? q.updatedAt);
}

/** Accepted this calendar month. */
export function isWonThisMonth(q: Quote, now: Date): boolean {
  if (q.status !== "accepted") return false;
  const at = answeredAt(q);
  return at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth();
}

export interface MoneySum {
  count: number;
  /** In the business's currency, minor units. */
  amount: bigint;
  /** Some quotes are in another currency, so aren't in `amount`. */
  otherCurrencies: boolean;
}

function sum(quotes: Quote[], currency: string): MoneySum {
  let amount = 0n;
  let other = false;
  for (const q of quotes) {
    if (q.currency === currency) amount += BigInt(q.totalAmount);
    else other = true;
  }
  return { count: quotes.length, amount, otherCurrencies: other };
}

export interface QuoteStats {
  open: MoneySum;
  expiring: number;
  won: MoneySum;
  /** Accepted ÷ answered or expired in the last 90 days. */
  winRate: { won: number; closed: number };
}

/** US-QUO-27 — counts each quote once, as its newest version. */
export function quoteStats(quotes: Quote[], currency: string, now: Date): QuoteStats {
  const latest = latestVersions(quotes);
  const since = now.getTime() - 90 * DAY;
  let won = 0;
  let closed = 0;
  for (const q of latest) {
    if (q.status === "accepted" || q.status === "rejected") {
      if (answeredAt(q).getTime() >= since) {
        closed += 1;
        if (q.status === "accepted") won += 1;
      }
    } else if (q.isExpired && q.validUntil && new Date(q.validUntil).getTime() >= since) {
      closed += 1;
    }
  }
  return {
    open: sum(latest.filter(isOpen), currency),
    expiring: latest.filter((q) => isExpiringSoon(q, now)).length,
    won: sum(latest.filter((q) => isWonThisMonth(q, now)), currency),
    winRate: { won, closed },
  };
}

/** "42%", or "—" when nothing closed. */
export function winRateText(rate: { won: number; closed: number }): string {
  return rate.closed ? `${Math.round((rate.won / rate.closed) * 100)}%` : "—";
}

/** Number, title, contact or a line name contains the search (case-insensitive). */
export function matchesQuoteSearch(q: Quote, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [q.number ?? "", q.title ?? "", q.contactName ?? "", ...(q.lineNames ?? [])].some((field) => field.toLowerCase().includes(needle));
}

function matchesStatus(q: Quote, status: string[]): boolean {
  if (!status.length) return true;
  return status.includes(q.status) || (status.includes("expired") && q.isExpired);
}

/**
 * The rows the list shows. Status, contact, card and search are decided by
 * each quote's newest version; every version of a matching quote stays, so
 * older versions still open under it.
 */
export function filterQuotes(quotes: Quote[], state: QuotesListState, now: Date): Quote[] {
  const keep = new Set<string>();
  for (const q of latestVersions(quotes)) {
    if (state.contact && q.contactId !== state.contact) continue;
    if (!matchesStatus(q, state.status)) continue;
    if (state.card === "open" && !isOpen(q)) continue;
    if (state.card === "expiring" && !isExpiringSoon(q, now)) continue;
    if (state.card === "won" && !isWonThisMonth(q, now)) continue;
    if (!matchesQuoteSearch(q, state.q)) continue;
    keep.add(q.rootQuoteId);
  }
  return quotes.filter((q) => keep.has(q.rootQuoteId));
}

/** "12 Oct" (or "12 Oct 2025" in another year), in the business's locale. */
export function shortDate(iso: string, now: Date, locale?: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

/** A date with no time ("2026-10-15") in the business's locale, without shifting a day across time zones. */
export function calendarDate(iso: string, now: Date, locale?: string): string {
  const d = new Date(iso);
  return shortDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toISOString(), now, locale);
}

/** US-QUO-29 — what goes under "Valid until": a countdown, "Expired 2 days ago", or when it was answered. */
export function validityNote(q: Quote, now: Date, locale?: string): { text: string; tone: "" | "soon" | "gone" } {
  if (q.status === "accepted") return { text: q.respondedAt ? t("quotes.listState.acceptedOn", { date: shortDate(q.respondedAt, now, locale) }) : t("quotes.listState.accepted"), tone: "" };
  if (q.status === "rejected") return { text: q.respondedAt ? t("quotes.listState.declinedOn", { date: shortDate(q.respondedAt, now, locale) }) : t("quotes.listState.declined"), tone: "" };
  if (!q.validUntil) return { text: "", tone: "" };
  const days = daysUntil(q.validUntil, now);
  if (days < 0) return { text: t("quotes.listState.expiredAgo", { count: -days }), tone: q.status === "sent" ? "gone" : "" };
  if (days === 0) return { text: t("quotes.listState.today"), tone: "soon" };
  return { text: t("quotes.listState.inDays", { count: days }), tone: days <= 7 && q.status === "sent" ? "soon" : "" };
}

/** The contacts that have a quote, for the Contact filter. */
export function quoteContacts(quotes: Quote[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const q of quotes) if (!seen.has(q.contactId)) seen.set(q.contactId, q.contactName ?? t("quotes.listState.unknownContact"));
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}
