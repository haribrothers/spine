import type { TableSort } from "@spine/ui";
import type { CustomerRefund } from "@spine/shared";
import { formatMoney } from "../../../lib/money";
import type { CreditNoteRow } from "./types";
import { t } from "../../../lib/i18n";

/** US-INV-40 — what the "Where it went" filter offers. */
export type WhereItWent = "off" | "left" | "applied" | "refunded";
export const WHERE_LABELS: Record<WhereItWent, string> = {
  off: t("creditNotes.where.off"),
  left: t("creditNotes.where.left"),
  applied: t("creditNotes.where.applied"),
  refunded: t("creditNotes.where.refunded"),
};
const WHERE = Object.keys(WHERE_LABELS) as WhereItWent[];

/** US-INV-41 (D-210, D-219) — what the credit notes list shows, kept in the address. */
export interface CreditNotesListState {
  q: string;
  where: WhereItWent[];
  contact: string;
  /** The "Credit to use" card. */
  card: "" | "left";
  sort: TableSort | null;
  page: number;
}

export function parseCreditNotesState(params: URLSearchParams): CreditNotesListState {
  const where = params
    .getAll("where")
    .flatMap((s) => s.split(","))
    .filter((s): s is WhereItWent => WHERE.includes(s as WhereItWent));
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    where: [...new Set(where)],
    contact: params.get("contact") ?? "",
    card: params.get("card") === "left" ? "left" : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/credit-notes` is the whole list, newest first. */
export function creditNotesQuery(state: CreditNotesListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const w of state.where) params.append("where", w);
  if (state.contact) params.set("contact", state.contact);
  if (state.card) params.set("card", state.card);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasCreditNoteFilters(state: CreditNotesListState): boolean {
  return Boolean(state.q.trim() || state.where.length || state.contact || state.card);
}

const big = (v: string | null | undefined) => BigInt(v ?? "0");

/** A credit note's state: a draft left unissued, credit still to use, or all of it accounted for. */
export type CreditNoteState = "draft" | "credit_left" | "credited";
export function creditNoteState(note: Pick<CreditNoteRow, "status" | "creditRemainingAmount">): CreditNoteState {
  if (note.status === "draft") return "draft";
  return big(note.creditRemainingAmount) > 0n ? "credit_left" : "credited";
}
export const CREDIT_NOTE_STATE_LABELS: Record<CreditNoteState, string> = { draft: t("creditNotes.state.draft"), credit_left: t("creditNotes.state.creditLeft"), credited: t("creditNotes.state.credited") };

export interface WherePart {
  kind: WhereItWent;
  text: string;
}

/** US-INV-40 — "Off INV-0041", "Applied ₹10,000.00", "Refunded ₹5,900.00", "₹7,856.00 left": where a credit note's money went. */
export function whereItWent(note: CreditNoteRow): WherePart[] {
  if (note.status !== "issued") return [];
  const money = (v: bigint) => formatMoney(v, note.currency);
  const parts: WherePart[] = [];
  if (big(note.offInvoiceAmount) > 0n) parts.push({ kind: "off", text: t("creditNotes.list.offInvoice", { number: note.invoiceNumber ?? t("creditNotes.list.theInvoice") }) });
  if (big(note.appliedAmount) > 0n) parts.push({ kind: "applied", text: t("creditNotes.list.applied", { amount: money(big(note.appliedAmount)) }) });
  if (big(note.refundedAmount) > 0n) parts.push({ kind: "refunded", text: t("creditNotes.list.refunded", { amount: money(big(note.refundedAmount)) }) });
  if (big(note.creditRemainingAmount) > 0n) parts.push({ kind: "left", text: t("creditNotes.list.left", { amount: money(big(note.creditRemainingAmount)) }) });
  return parts;
}

export interface MoneySum {
  count: number;
  /** In the business's currency, minor units. */
  amount: bigint;
  /** Some are in another currency, so aren't in `amount`. */
  otherCurrencies: boolean;
}

const thisMonth = (iso: string | null | undefined, now: Date) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export interface CreditNoteStats {
  /** Issued this calendar month: their total, and how many. */
  credited: MoneySum;
  /** Credit customers still hold from credit notes; `count` is how many customers. */
  toUse: MoneySum;
}

export function creditNoteStats(list: CreditNoteRow[], currency: string, now: Date): CreditNoteStats {
  const credited: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  const toUse: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  const customers = new Set<string>();
  for (const note of list) {
    if (note.status !== "issued") continue;
    if (thisMonth(note.issuedAt, now)) {
      credited.count += 1;
      if (note.currency === currency) credited.amount += big(note.totalAmount);
      else credited.otherCurrencies = true;
    }
    const left = big(note.creditRemainingAmount);
    if (left > 0n) {
      customers.add(note.contactId);
      if (note.currency === currency) toUse.amount += left;
      else toUse.otherCurrencies = true;
    }
  }
  toUse.count = customers.size;
  return { credited, toUse };
}

/** "Refunded this month" — refunds of credit-note credit dated this month, not deleted. */
export function refundedThisMonth(refunds: CustomerRefund[], currency: string, now: Date): MoneySum {
  const sum: MoneySum = { count: 0, amount: 0n, otherCurrencies: false };
  for (const r of refunds) {
    if (r.source.kind !== "credit_note" || r.deletedAt || !thisMonth(r.date, now)) continue;
    sum.count += 1;
    if (r.currency === currency) sum.amount += big(r.amount);
    else sum.otherCurrencies = true;
  }
  return sum;
}

/** US-INV-41 — number, customer, invoice number, reason or a line's name contains the search (case-insensitive). */
export function matchesCreditNoteSearch(note: CreditNoteRow, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [note.number ?? "", note.contactName ?? "", note.invoiceNumber ?? "", note.reason ?? "", ...(note.lineNames ?? [])].some((field) => field.toLowerCase().includes(needle));
}

export function filterCreditNotes(list: CreditNoteRow[], state: CreditNotesListState): CreditNoteRow[] {
  return list.filter((note) => {
    if (state.contact && note.contactId !== state.contact) return false;
    if (state.card === "left" && big(note.creditRemainingAmount) <= 0n) return false;
    if (state.where.length) {
      const kinds = whereItWent(note).map((p) => p.kind);
      if (!state.where.some((w) => kinds.includes(w))) return false;
    }
    return matchesCreditNoteSearch(note, state.q);
  });
}

/** The contacts that have a credit note, for the Contact filter. */
export function creditNoteContacts(list: CreditNoteRow[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const note of list) if (!seen.has(note.contactId)) seen.set(note.contactId, note.contactName ?? t("creditNotes.list.unknownContact"));
  return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}
