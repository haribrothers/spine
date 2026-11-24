import type { TableSort } from "@spine/ui";
import type { Expense } from "./types";
import { t } from "../../../lib/i18n";

/**
 * US-PUR-42/43 (D-227) — where an expense stands, in words. "Billed" is
 * worked out from the invoice line it was billed on, never stored; the API's
 * status stays submitted | approved | rejected.
 */
export type ExpenseState = "wait" | "appr" | "billed" | "rej";

export const EXPENSE_STATE_LABELS: Record<ExpenseState, string> = {
  wait: t("expenses.state.wait"),
  appr: t("expenses.state.appr"),
  billed: t("expenses.state.billed"),
  rej: t("expenses.state.rej"),
};

export const EXPENSE_STATE_CLASS: Record<ExpenseState, string> = {
  wait: "bg-due-soon-bg text-due-soon",
  appr: "bg-paid-bg text-paid",
  billed: "bg-info-bg text-primary",
  rej: "bg-overdue-bg text-overdue",
};

type StateFigures = Pick<Expense, "status" | "billedOnInvoiceLineId">;

export function expenseState(expense: StateFigures): ExpenseState {
  if (expense.status === "submitted") return "wait";
  if (expense.status === "rejected") return "rej";
  return expense.billedOnInvoiceLineId ? "billed" : "appr";
}

/** Approved, billable and not on an invoice yet. */
export function readyToBill(expense: Pick<Expense, "status" | "isBillable" | "billedOnInvoiceLineId">): boolean {
  return expense.status === "approved" && expense.isBillable && !expense.billedOnInvoiceLineId;
}

/** US-PUR-20 — only an Owner reviews their own expense. */
export function canReviewThis(expense: Pick<Expense, "status" | "submittedByUserId">, me: string | null, isOwner: boolean): boolean {
  return expense.status === "submitted" && (isOwner || expense.submittedByUserId !== me);
}

// ---------- The list (US-PUR-42, D-210) ----------

export const EXPENSE_STATES: ExpenseState[] = ["wait", "appr", "billed", "rej"];
export type ExpenseCard = "" | "wait" | "bill" | "rej";
export const ME = "me";

export interface ExpensesListState {
  states: ExpenseState[];
  category: string;
  /** A user id, or "me". */
  by: string;
  card: ExpenseCard;
  q: string;
  sort: TableSort | null;
  page: number;
}

/**
 * `?state=wait,appr&category=&by=me&card=&q=&sort=key.dir&page=` — the job
 * stays in its own `?jobId=` (US-PUR-22). The dashboard's older links still
 * work: `?status=submitted` (waiting), `?mine=true` (mine) and
 * `?billable=unbilled` (Ready to bill).
 */
export function parseExpensesState(params: URLSearchParams): ExpensesListState {
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const legacyStatus: Record<string, ExpenseState> = { submitted: "wait", approved: "appr", rejected: "rej" };
  const states = [
    ...(params.get("state") ?? "").split(",").filter((s): s is ExpenseState => (EXPENSE_STATES as string[]).includes(s)),
    ...(params.get("status") ?? "").split(",").map((s) => legacyStatus[s]).filter((s): s is ExpenseState => !!s),
  ];
  const card = params.get("card") ?? (params.get("billable") === "unbilled" ? "bill" : "");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    states: [...new Set(states)],
    category: params.get("category") ?? "",
    by: params.get("by") ?? (params.get("mine") === "true" ? ME : ""),
    card: card === "wait" || card === "bill" || card === "rej" ? card : "",
    q: params.get("q") ?? "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state, keeping `jobId`; defaults are left out. */
export function expensesQuery(state: ExpensesListState, jobId?: string | null): string {
  const params = new URLSearchParams();
  if (state.states.length) params.set("state", state.states.join(","));
  if (state.category) params.set("category", state.category);
  if (state.by) params.set("by", state.by);
  if (jobId) params.set("jobId", jobId);
  if (state.card) params.set("card", state.card);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function hasExpenseFilters(state: ExpensesListState): boolean {
  return Boolean(state.states.length || state.category || state.by || state.card || state.q.trim());
}

/** `approver` is someone who reviews other people's expenses (not an Owner, who may review their own too, US-PUR-20). */
function inCard(expense: Expense, card: ExpenseCard, me: string | null, approver: boolean): boolean {
  if (!card) return true;
  if (card === "wait") return expense.status === "submitted" && (!approver || expense.submittedByUserId !== me);
  if (card === "bill") return readyToBill(expense);
  return expense.status === "rejected";
}

/** The expenses on screen: state, category, who, card and search (number, description, category, job or person). */
export function filterExpenses(expenses: Expense[], state: ExpensesListState, me: string | null, approver: boolean): Expense[] {
  const needle = state.q.trim().toLowerCase();
  const by = state.by === ME ? me : state.by;
  return expenses.filter((e) => {
    if (state.states.length && !state.states.includes(expenseState(e))) return false;
    if (state.category && e.categoryId !== state.category) return false;
    if (by && e.submittedByUserId !== by) return false;
    if (!inCard(e, state.card, me, approver)) return false;
    if (!needle) return true;
    return [e.number ?? "", e.description ?? "", e.categoryName ?? "", e.jobName ?? "", e.submittedByName ?? ""].some((f) => f.toLowerCase().includes(needle));
  });
}

export interface ExpenseStats {
  waiting: { amount: bigint; count: number };
  approvedThisMonth: { amount: bigint; count: number };
  toBill: { amount: bigint; count: number };
  rejected: { count: number };
}

/**
 * US-PUR-42 — the cards, in the business's currency (other currencies
 * aren't added in). For an approver, Waiting counts other people's only —
 * what's waiting on them.
 */
export function expenseStats(expenses: Expense[], currency: string, today: Date, me: string | null, approver: boolean): ExpenseStats {
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const stats: ExpenseStats = { waiting: { amount: 0n, count: 0 }, approvedThisMonth: { amount: 0n, count: 0 }, toBill: { amount: 0n, count: 0 }, rejected: { count: 0 } };
  for (const e of expenses) {
    if (e.status === "rejected") stats.rejected.count += 1;
    if (e.currency !== currency) continue;
    const amount = BigInt(e.amount);
    if (inCard(e, "wait", me, approver)) {
      stats.waiting.count += 1;
      stats.waiting.amount += amount;
    }
    if (e.status === "approved" && (e.approvedAt ?? "").slice(0, 7) === month) {
      stats.approvedThisMonth.count += 1;
      stats.approvedThisMonth.amount += amount;
    }
    if (readyToBill(e)) {
      stats.toBill.count += 1;
      stats.toBill.amount += amount;
    }
  }
  return stats;
}

/** US-PUR-43 — the next expense waiting on me, oldest first, after this one. */
export function nextWaiting(expenses: Expense[], currentId: string, me: string | null, isOwner: boolean): Expense | null {
  return (
    expenses
      .filter((e) => e.id !== currentId && canReviewThis(e, me, isOwner))
      .sort((a, b) => `${a.date.slice(0, 10)}${a.createdAt}`.localeCompare(`${b.date.slice(0, 10)}${b.createdAt}`))[0] ?? null
  );
}
