import type { TableSort } from "@spine/ui";
import { inPayablesAge, parsePayablesAge, PAYABLES_AGE_LABELS, type PayablesAge } from "@spine/shared";
import type { PayablesBillRow, PayablesVendorRow } from "./types";

export type PayablesTab = "vendor" | "bill";

/** US-PUR-60 (D-210, D-230) — what Payables shows, kept in the address. */
export interface PayablesListState {
  tab: PayablesTab;
  age: PayablesAge | null;
  q: string;
  sort: TableSort | null;
  page: number;
}

/** `?view=bills`, `?age=` (or the dashboard's `?overdue=1`), `?q=`, `?sort=key.dir`, `?page=`. */
export function parsePayablesState(params: URLSearchParams): PayablesListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    tab: params.get("view") === "bills" ? "bill" : "vendor",
    age: parsePayablesAge(params.get("age"), params.get("overdue")),
    q: params.get("q") ?? "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/payables` is every vendor we owe. */
export function payablesQuery(state: PayablesListState): string {
  const params = new URLSearchParams();
  if (state.tab === "bill") params.set("view", "bills");
  if (state.age) params.set("age", state.age);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.trim().toLowerCase());

/** "By bill": the bills in the age whose number, vendor or job contains the search. */
export function filterBills(rows: PayablesBillRow[], state: Pick<PayablesListState, "age" | "q">): PayablesBillRow[] {
  return rows.filter((r) => inPayablesAge(r, state.age) && (!state.q.trim() || contains(`${r.billNumber} ${r.contactName ?? ""} ${r.jobName ?? ""}`, state.q)));
}

export interface VendorView extends PayablesVendorRow {
  bills: PayablesBillRow[];
}

/**
 * "By vendor": each vendor with bills in the age, added up over those
 * bills; credit and last paid are the vendor's own. The server's order —
 * most overdue money first, then the most owed.
 */
export function vendorView(vendors: PayablesVendorRow[], bills: PayablesBillRow[], state: Pick<PayablesListState, "age" | "q">): VendorView[] {
  const byContact = new Map<string, PayablesBillRow[]>();
  for (const r of bills) if (inPayablesAge(r, state.age)) byContact.set(r.contactId, [...(byContact.get(r.contactId) ?? []), r]);
  const out: VendorView[] = [];
  for (const v of vendors) {
    const rows = byContact.get(v.contactId);
    if (!rows?.length) continue;
    if (state.q.trim() && !contains(v.name ?? "", state.q)) continue;
    // Oldest due first under the vendor; bills with no due date last.
    const sorted = [...rows].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    const oldest = sorted.find((r) => r.dueDate);
    out.push({
      ...v,
      billCount: rows.length,
      overdueAmount: rows.filter((r) => r.bucket !== "current").reduce((s, r) => s + BigInt(r.balanceDue), 0n).toString(),
      totalOutstanding: rows.reduce((s, r) => s + BigInt(r.balanceDue), 0n).toString(),
      oldestDaysOverdue: oldest ? oldest.daysOverdue : -1,
      oldestDueDate: oldest?.dueDate ?? null,
      bills: sorted,
    });
  }
  return out;
}

/** "Nothing 31–60 days late." — what an empty age says. */
export function emptyAge(age: PayablesAge): string {
  if (age === "current") return "Nothing that isn't due yet.";
  if (age === "overdue") return "Nothing overdue.";
  if (age === "due7") return "Nothing due in the next 7 days.";
  return `Nothing ${PAYABLES_AGE_LABELS[age]} late.`;
}

/** US-PUR-58 — why the ticked bills can't be paid together, or null when they can (one vendor). */
export function payBlocked(bills: Pick<PayablesBillRow, "contactId">[]): string | null {
  return new Set(bills.map((b) => b.contactId)).size > 1 ? "Pick bills from one vendor — a payment is for one vendor." : null;
}

/** US-PUR-60 — "2 draft bills (₹18,400.00) aren't counted here — record them to include them." */
export function draftsNote(drafts: { count: number }, amount: string): string | null {
  if (drafts.count === 0) return null;
  return `${drafts.count} draft ${drafts.count === 1 ? "bill" : "bills"} (${amount}) ${drafts.count === 1 ? "isn't" : "aren't"} counted here — record ${drafts.count === 1 ? "it" : "them"} to include ${drafts.count === 1 ? "it" : "them"}.`;
}
