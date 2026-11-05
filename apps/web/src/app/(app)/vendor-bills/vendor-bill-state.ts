import type { TableSort } from "@spine/ui";
import { formatMoney } from "../../../lib/money";
import { t } from "../../../lib/i18n";
import type { VendorBill } from "./types";

/** US-PUR-32/34 (D-225) — where a bill stands, in words; worked out from its status, balance and due date, never stored. */
export type BillState = "draft" | "unpaid" | "partly" | "paid" | "overdue" | "void";

export const BILL_STATE_LABELS: Record<BillState, string> = {
  draft: t("vendorBills.billStates.draft"),
  unpaid: t("vendorBills.billStates.unpaid"),
  partly: t("vendorBills.billStates.partly"),
  paid: t("vendorBills.billStates.paid"),
  overdue: t("vendorBills.billStates.overdue"),
  void: t("vendorBills.billStates.void"),
};

export const BILL_STATE_CLASS: Record<BillState, string> = {
  draft: "bg-draft-bg text-draft",
  unpaid: "bg-due-soon-bg text-due-soon",
  partly: "bg-info-bg text-primary",
  paid: "bg-paid-bg text-paid",
  overdue: "bg-overdue-bg text-overdue",
  void: "bg-draft-bg text-draft line-through",
};

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Days past the due date (negative before it); null without one. */
export function daysLate(dueDate: string | null, today: Date): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  return Math.round((startOfDay(today).getTime() - due.getTime()) / DAY_MS);
}

type BillFigures = Pick<VendorBill, "status" | "dueDate" | "balanceDue" | "amountPaid"> & { creditedAmount?: string };

export function billState(bill: BillFigures, today: Date): BillState {
  if (bill.status === "draft") return "draft";
  if (bill.status === "void") return "void";
  const balance = BigInt(bill.balanceDue);
  if (balance <= 0n) return "paid";
  const late = daysLate(bill.dueDate, today);
  if (late !== null && late > 0) return "overdue";
  return BigInt(bill.amountPaid) + BigInt(bill.creditedAmount ?? "0") > 0n ? "partly" : "unpaid";
}

/** Whether money is still owed on a recorded bill (Pay bill, Apply credit). */
export function owes(bill: BillFigures): boolean {
  return bill.status === "recorded" && BigInt(bill.balanceDue) > 0n;
}

/** "12 days late", "Due today", "Due in 5 days" — only while money is owed; otherwise nothing. */
export function lateLabel(bill: BillFigures, today: Date): string | null {
  if (!owes(bill)) return null;
  const late = daysLate(bill.dueDate, today);
  if (late === null) return null;
  if (late > 0) return t("vendorBills.state.daysLate", { count: late });
  if (late === 0) return t("vendorBills.state.dueToday");
  return t("vendorBills.state.dueInDays", { count: -late });
}

// ---------- The list (US-PUR-34, D-210) ----------

export const BILL_STATES: BillState[] = ["draft", "unpaid", "partly", "overdue", "paid", "void"];
export type BillCard = "" | "overdue" | "due7" | "drafts";

export interface VendorBillsListState {
  states: BillState[];
  vendor: string;
  card: BillCard;
  q: string;
  sort: TableSort | null;
  page: number;
}

/** `?state=overdue,partly&vendor=&card=&q=&sort=key.dir&page=` — the job stays in its own `?jobId=` (US-PUR-22). */
export function parseVendorBillsState(params: URLSearchParams): VendorBillsListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const card = params.get("card");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    states: [...new Set((params.get("state") ?? "").split(",").filter((s): s is BillState => (BILL_STATES as string[]).includes(s)))],
    vendor: params.get("vendor") ?? "",
    card: card === "overdue" || card === "due7" || card === "drafts" ? card : "",
    q: params.get("q") ?? "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state, keeping `jobId`; defaults are left out. */
export function vendorBillsQuery(state: VendorBillsListState, jobId?: string | null): string {
  const params = new URLSearchParams();
  if (state.states.length) params.set("state", state.states.join(","));
  if (state.vendor) params.set("vendor", state.vendor);
  if (jobId) params.set("jobId", jobId);
  if (state.card) params.set("card", state.card);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasBillFilters(state: VendorBillsListState): boolean {
  return Boolean(state.states.length || state.vendor || state.card || state.q.trim());
}

function inCard(bill: VendorBill, card: BillCard, today: Date): boolean {
  if (!card) return true;
  if (card === "drafts") return bill.status === "draft";
  const late = daysLate(bill.dueDate, today);
  if (!owes(bill) || late === null) return false;
  return card === "overdue" ? late > 0 : late <= 0 && late >= -7;
}

/** The bills on screen: state, vendor, card and search (bill number, vendor or job name). */
export function filterBills(bills: VendorBill[], state: VendorBillsListState, today: Date, jobName: (id: string | null) => string | null): VendorBill[] {
  const needle = state.q.trim().toLowerCase();
  return bills.filter((b) => {
    if (state.states.length && !state.states.includes(billState(b, today))) return false;
    if (state.vendor && b.contactId !== state.vendor) return false;
    if (!inCard(b, state.card, today)) return false;
    if (!needle) return true;
    return [b.billNumber, b.contactName ?? "", jobName(b.jobId) ?? ""].some((f) => f.toLowerCase().includes(needle));
  });
}

export interface BillStats {
  toPay: { amount: bigint; count: number };
  overdue: { amount: bigint; count: number };
  due7: { amount: bigint; count: number; by: Date };
  drafts: { amount: bigint; count: number };
}

/** US-PUR-34 — the cards, in the business's currency (bills in another currency aren't added in). */
export function billStats(bills: VendorBill[], currency: string, today: Date): BillStats {
  const by = new Date(startOfDay(today).getTime() + 7 * DAY_MS);
  const stats: BillStats = { toPay: { amount: 0n, count: 0 }, overdue: { amount: 0n, count: 0 }, due7: { amount: 0n, count: 0, by }, drafts: { amount: 0n, count: 0 } };
  for (const b of bills) {
    if (b.currency !== currency) continue;
    if (b.status === "draft") {
      stats.drafts.count += 1;
      stats.drafts.amount += BigInt(b.totalAmount);
      continue;
    }
    if (!owes(b)) continue;
    const balance = BigInt(b.balanceDue);
    stats.toPay.count += 1;
    stats.toPay.amount += balance;
    if (inCard(b, "overdue", today)) {
      stats.overdue.count += 1;
      stats.overdue.amount += balance;
    } else if (inCard(b, "due7", today)) {
      stats.due7.count += 1;
      stats.due7.amount += balance;
    }
  }
  return stats;
}

/** US-PUR-35 — the due date a vendor's last bill implies for a new one: the same number of days after the bill date. */
export function suggestedDueDays(bills: Pick<VendorBill, "date" | "dueDate" | "createdAt" | "status">[]): number | null {
  const last = bills
    .filter((b) => b.dueDate && b.status !== "void")
    .sort((a, b) => (b.date.slice(0, 10) + b.createdAt).localeCompare(a.date.slice(0, 10) + a.createdAt))[0];
  if (!last?.dueDate) return null;
  const days = Math.round((new Date(`${last.dueDate.slice(0, 10)}T00:00:00`).getTime() - new Date(`${last.date.slice(0, 10)}T00:00:00`).getTime()) / DAY_MS);
  return days >= 0 ? days : null;
}

/** US-PUR-32 — the toast when a bill is recorded, from its page, a row or "Save and record". */
export function billRecordedToast(bill: Pick<VendorBill, "billNumber" | "totalAmount" | "currency" | "contactName">): [string, string] {
  return [
    t("vendorBills.state.recordedToastTitle", { number: bill.billNumber }),
    t("vendorBills.state.recordedToastDescription", { amount: formatMoney(BigInt(bill.totalAmount), bill.currency), vendor: bill.contactName ?? t("vendorBills.state.theVendor") }),
  ];
}
