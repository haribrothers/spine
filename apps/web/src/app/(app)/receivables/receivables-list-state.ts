import type { TableSort } from "@spine/ui";
import { inReceivablesAge, parseReceivablesAge, type ReceivablesAge } from "@spine/shared";
import type { ReceivablesCustomerRow, ReceivablesInvoiceRow } from "./types";
import { t } from "../../../lib/i18n";

export type ReceivablesTab = "customer" | "invoice";

/** US-PAY-31 (D-210, D-224) — what Receivables shows, kept in the address. */
export interface ReceivablesListState {
  tab: ReceivablesTab;
  age: ReceivablesAge | null;
  q: string;
  sort: TableSort | null;
  page: number;
}

/** `?view=invoices`, `?age=` (or the dashboard's `?overdue=1`), `?q=`, `?sort=key.dir`, `?page=`. */
export function parseReceivablesState(params: URLSearchParams): ReceivablesListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    tab: params.get("view") === "invoices" ? "invoice" : "customer",
    age: parseReceivablesAge(params.get("age"), params.get("overdue")),
    q: params.get("q") ?? "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/receivables` is every customer who owes. */
export function receivablesQuery(state: ReceivablesListState): string {
  const params = new URLSearchParams();
  if (state.tab === "invoice") params.set("view", "invoices");
  if (state.age) params.set("age", state.age);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.trim().toLowerCase());

/** "By invoice": the invoices in the age whose number or customer contains the search. */
export function filterInvoices(rows: ReceivablesInvoiceRow[], state: Pick<ReceivablesListState, "age" | "q">): ReceivablesInvoiceRow[] {
  return rows.filter((r) => inReceivablesAge(r.bucket, state.age) && (!state.q.trim() || contains(`${r.number ?? ""} ${r.contactName ?? ""}`, state.q)));
}

export interface CustomerView extends ReceivablesCustomerRow {
  invoices: ReceivablesInvoiceRow[];
}

/**
 * "By customer": each customer with invoices in the age, added up over
 * those invoices (so "90+ days" shows what each owes that's that late);
 * credit, email and the last reminder are the customer's own. Most overdue
 * money first, then the most owed (the server's order for every age).
 */
export function customerView(customers: ReceivablesCustomerRow[], invoices: ReceivablesInvoiceRow[], state: Pick<ReceivablesListState, "age" | "q">): CustomerView[] {
  const inAge = invoices.filter((r) => inReceivablesAge(r.bucket, state.age));
  const byContact = new Map<string, ReceivablesInvoiceRow[]>();
  for (const r of inAge) byContact.set(r.contactId, [...(byContact.get(r.contactId) ?? []), r]);
  const out: CustomerView[] = [];
  for (const c of customers) {
    const rows = byContact.get(c.contactId);
    if (!rows?.length) continue;
    if (state.q.trim() && !contains(c.name ?? "", state.q)) continue;
    const overdue = rows.filter((r) => r.bucket !== "current").reduce((s, r) => s + BigInt(r.balanceDue), 0n);
    const total = rows.reduce((s, r) => s + BigInt(r.balanceDue), 0n);
    out.push({
      ...c,
      invoiceCount: rows.length,
      overdueAmount: overdue.toString(),
      totalOutstanding: total.toString(),
      oldestDaysOverdue: Math.max(...rows.map((r) => r.daysOverdue)),
      // Oldest due first under the customer.
      invoices: [...rows].sort((a, b) => b.daysOverdue - a.daysOverdue),
    });
  }
  return out;
}

/** US-PAY-30 — how late an invoice is, in words: "12 days late", "Due today", "Due in 5 days", "No due date". */
export function howLate(row: Pick<ReceivablesInvoiceRow, "dueDate" | "daysOverdue">): string {
  if (!row.dueDate) return t("receivables.list.noDueDate");
  if (row.daysOverdue > 0) return t("receivables.list.daysLate", { count: row.daysOverdue });
  if (row.daysOverdue === 0) return t("receivables.list.dueToday");
  return t("receivables.list.dueInDays", { count: -row.daysOverdue });
}

/** US-PAY-27 — the customer's oldest: "45 days late", or "Not due yet". */
export function oldestLabel(days: number): string {
  return days > 0 ? t("receivables.list.daysLate", { count: days }) : t("receivables.list.notDueYet");
}

/** Why Send reminder can't go for an invoice, or null when it can (the bulk send's reasons, US-INV-23). */
export function reminderBlocked(row: Pick<ReceivablesInvoiceRow, "remindedToday" | "contactHasEmail">): string | null {
  if (row.remindedToday) return t("receivables.list.remindedToday");
  if (!row.contactHasEmail) return t("receivables.list.noEmail");
  return null;
}
