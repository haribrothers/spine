import type { ExpenseCategoryUsage } from "@spine/shared";
import type { ExpenseCategory } from "../types";
import { t } from "../../../../lib/i18n";

/**
 * US-PUR-46 (D-228) — Expenses › Categories: Active, Archived or All, and a
 * name search, kept in the address (`?state=archived&q=fuel`; Active is the
 * default and left out).
 */
export type CategoryStateFilter = "active" | "archived" | "all";

export interface CategoriesListState {
  state: CategoryStateFilter;
  q: string;
}

export const CATEGORY_STATE_OPTIONS: { value: CategoryStateFilter; label: string }[] = [
  { value: "active", label: t("expenses.categories.active") },
  { value: "archived", label: t("expenses.categories.archived") },
  { value: "all", label: t("expenses.categories.all") },
];

export function parseCategoriesState(params: URLSearchParams): CategoriesListState {
  const state = params.get("state");
  return { state: state === "archived" || state === "all" ? state : "active", q: params.get("q") ?? "" };
}

export function categoriesQuery(state: CategoriesListState): string {
  const params = new URLSearchParams();
  if (state.state !== "active") params.set("state", state.state);
  if (state.q.trim()) params.set("q", state.q.trim());
  return params.toString();
}

export function hasCategoryFilters(state: CategoriesListState): boolean {
  return state.state !== "active" || Boolean(state.q.trim());
}

/** The one posting to 5200 Direct Labour is the one "Headcount × day rate" preselects (US-PUR-23). */
export const isLabourCategory = (category: Pick<ExpenseCategory, "accountCode">) => category.accountCode === "5200";

/** The rows on screen: the state filter and a search over the name and what it's for; Active first, then by name. */
export function filterCategories(categories: ExpenseCategory[], state: CategoriesListState): ExpenseCategory[] {
  const needle = state.q.trim().toLowerCase();
  return categories
    .filter((c) => (state.state === "active" ? !c.archivedAt : state.state === "archived" ? Boolean(c.archivedAt) : true))
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (c.description ?? "").toLowerCase().includes(needle))
    .sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)) || a.name.localeCompare(b.name));
}

/** Usage by category id; a category no expense uses reads 0 and "—". */
export function usageFor(usage: ExpenseCategoryUsage[] | null, id: string): { expenseCount: number; approvedThisMonth: bigint } | null {
  if (!usage) return null;
  const row = usage.find((u) => u.categoryId === id);
  return { expenseCount: row?.expenseCount ?? 0, approvedThisMonth: BigInt(row?.approvedThisMonth ?? "0") };
}
