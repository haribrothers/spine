import { minorUnitExponent } from "@spine/shared/money";
import type { TableSort } from "@spine/ui";
import type { Account, CatalogItem, TaxGroupOption, TaxRateOption } from "./types";

/** US-CAT-10 — the setup filters the stat cards apply. */
export type SetupFilter = "" | "tax" | "account";

/** US-CAT-13 (D-210, D-213) — what the catalogue list shows, kept in the address. */
export interface CatalogListState {
  q: string;
  /** "active" and/or "archived"; empty means active only. */
  status: string[];
  categories: string[];
  /** Plain decimals in the item's own currency, e.g. "100" or "49.99". */
  min: string;
  max: string;
  setup: SetupFilter;
  sort: TableSort | null;
  page: number;
}

const DEFAULT_STATUS = ["active"];

export function parseCatalogState(params: URLSearchParams): CatalogListState {
  const status = params.getAll("status").filter((s) => s === "active" || s === "archived");
  const setup = params.get("setup");
  const sortParam = params.get("sort");
  let sort: TableSort | null = null;
  if (sortParam) {
    const [key, direction] = sortParam.split(".");
    if (key && (direction === "asc" || direction === "desc")) sort = { key, direction };
  }
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: params.get("q") ?? "",
    status: status.length ? status : DEFAULT_STATUS,
    categories: params.getAll("category"),
    min: params.get("min") ?? "",
    max: params.get("max") ?? "",
    setup: setup === "tax" || setup === "account" ? setup : "",
    sort,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** The query for a state; defaults are left out, so `/catalog` is the plain active list. */
export function catalogQuery(state: CatalogListState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  const defaultStatus = state.status.length === 1 && state.status[0] === "active";
  if (!defaultStatus) for (const s of state.status) params.append("status", s);
  for (const c of state.categories) params.append("category", c);
  if (state.min.trim()) params.set("min", state.min.trim());
  if (state.max.trim()) params.set("max", state.max.trim());
  if (state.setup) params.set("setup", state.setup);
  if (state.sort) params.set("sort", `${state.sort.key}.${state.sort.direction}`);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

/** Any filter beyond the plain active list (sort and page aside). */
export function hasCatalogFilters(state: CatalogListState): boolean {
  return Boolean(state.q.trim() || !(state.status.length === 1 && state.status[0] === "active") || state.categories.length || state.min.trim() || state.max.trim() || state.setup);
}

export function hasTax(item: CatalogItem): boolean {
  return Boolean(item.defaultTaxRateId || item.defaultTaxGroupId || item.defaultTaxRatePercentage > 0);
}

/**
 * US-CAT-10 (D-213) — an item missing its tax: no default tax, and not
 * deliberately untaxed. Exempt and non-taxable items never count; for a GST
 * business a zero-rated item is a choice too (its supply type is on the
 * form), while elsewhere "zero-rated" is just what an untaxed item defaults to.
 */
export function isMissingTax(item: CatalogItem, gst: boolean): boolean {
  if (hasTax(item)) return false;
  if (item.supplyClass === "exempt" || item.supplyClass === "non_taxable") return false;
  return gst ? item.supplyClass === "taxable" : true;
}

/** US-CAT-10 — no income account: its sales post to 4100 Sales — Services. */
export function hasNoIncomeAccount(item: CatalogItem): boolean {
  return !item.incomeAccountId;
}

/** A plain decimal in an item's currency, as minor units; null when blank or not a number. */
export function parseDecimalToMinorUnits(input: string, currency: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return BigInt(Math.round(value * 10 ** minorUnitExponent(currency)));
}

/** Name, description, category, unit or HSN/SAC contain the search (case-insensitive). */
export function matchesItemSearch(item: CatalogItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.description ?? "", item.category ?? "", item.unit, item.hsnSac ?? ""].some((field) => field.toLowerCase().includes(needle));
}

/** The items the list shows, by status, category, price, setup and search. */
export function filterCatalog(items: CatalogItem[], state: CatalogListState, gst: boolean): CatalogItem[] {
  const showActive = state.status.length === 0 || state.status.includes("active");
  const showArchived = state.status.includes("archived");
  return items.filter((item) => {
    if (item.archivedAt ? !showArchived : !showActive) return false;
    if (state.categories.length && (!item.category || !state.categories.includes(item.category))) return false;
    const amount = BigInt(item.defaultPriceAmount);
    const min = parseDecimalToMinorUnits(state.min, item.defaultPriceCurrency);
    if (min !== null && amount < min) return false;
    const max = parseDecimalToMinorUnits(state.max, item.defaultPriceCurrency);
    if (max !== null && amount > max) return false;
    if (state.setup === "tax" && !isMissingTax(item, gst)) return false;
    if (state.setup === "account" && !hasNoIncomeAccount(item)) return false;
    return matchesItemSearch(item, state.q);
  });
}

export interface CatalogStats {
  total: number;
  categories: string[];
  missingTax: number;
  noIncomeAccount: number;
}

/** US-CAT-10 — the cards count active items. */
export function catalogStats(items: CatalogItem[], gst: boolean): CatalogStats {
  const active = items.filter((item) => !item.archivedAt);
  return {
    total: active.length,
    categories: [...new Set(active.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b)),
    missingTax: active.filter((i) => isMissingTax(i, gst)).length,
    noIncomeAccount: active.filter(hasNoIncomeAccount).length,
  };
}

/** "Labour, Materials and 4 more". */
export function categoriesNote(categories: string[]): string {
  if (categories.length === 0) return "None yet";
  if (categories.length <= 2) return categories.join(" and ");
  return `${categories.slice(0, 2).join(", ")} and ${categories.length - 2} more`;
}

export type TaxLabelKind = "tax" | "none" | "class";

/** US-CAT-11 — what the Tax column says: the tax's name, the supply type for a deliberately untaxed item, or "No tax". */
export function taxLabel(
  item: CatalogItem,
  rates: Map<string, TaxRateOption>,
  groups: Map<string, TaxGroupOption>,
  gst: boolean,
): { kind: TaxLabelKind; text: string } {
  if (item.defaultTaxGroupId) return { kind: "tax", text: groups.get(item.defaultTaxGroupId)?.name ?? `${item.defaultTaxRatePercentage}%` };
  if (item.defaultTaxRateId) return { kind: "tax", text: rates.get(item.defaultTaxRateId)?.name ?? `${item.defaultTaxRatePercentage}%` };
  if (item.defaultTaxRatePercentage > 0) return { kind: "tax", text: `${item.defaultTaxRatePercentage}%` };
  if (item.supplyClass === "exempt") return { kind: "class", text: "Exempt" };
  if (item.supplyClass === "non_taxable") return { kind: "class", text: "Non-taxable" };
  if (gst && item.supplyClass === "zero_rated") return { kind: "class", text: "Zero-rated" };
  return { kind: "none", text: "No tax" };
}

/**
 * US-CAT-12 (D-213) — for a GST business, the inter-state tax that goes with
 * an intra-state group: the one active IGST rate at the group's total
 * ("IGST 18%" for "GST 18%"). Null when there's none, or more than one.
 */
export function interCounterpart(group: TaxGroupOption, rates: TaxRateOption[]): TaxRateOption | null {
  const total = group.taxRates.reduce((sum, r) => sum + r.rate, 0);
  const matches = rates.filter((r) => !r.archivedAt && r.taxType === "igst" && Math.abs(r.rate - total) < 1e-9);
  return matches.length === 1 ? matches[0]! : null;
}

/** US-CAT-12 — Export's columns: Import's, plus Category, so a file imports back. */
export const EXPORT_COLUMNS = ["Name", "Description", "Unit", "Category", "Price", "Tax", "HSN/SAC code", "Income account", "Expense account"] as const;

/** A price in minor units as a plain decimal, e.g. 41000n INR → "410.00". */
export function plainPrice(amount: bigint, currency: string): string {
  const exp = minorUnitExponent(currency);
  if (exp === 0) return amount.toString();
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const unit = 10n ** BigInt(exp);
  return `${negative ? "-" : ""}${abs / unit}.${(abs % unit).toString().padStart(exp, "0")}`;
}

/** US-CAT-12 — the rows Export writes, in `EXPORT_COLUMNS` order. Taxes by name and accounts by code, as Import matches them. */
export function exportRows(
  items: CatalogItem[],
  rates: Map<string, TaxRateOption>,
  groups: Map<string, TaxGroupOption>,
  accounts: Map<string, Account>,
): Record<(typeof EXPORT_COLUMNS)[number], string>[] {
  return items.map((item) => {
    const tax = item.defaultTaxGroupId ? (groups.get(item.defaultTaxGroupId)?.name ?? "") : item.defaultTaxRateId ? (rates.get(item.defaultTaxRateId)?.name ?? "") : "";
    const account = (id: string | null) => (id ? (accounts.get(id)?.code ?? "") : "");
    return {
      Name: item.name,
      Description: item.description ?? "",
      Unit: item.unit,
      Category: item.category ?? "",
      Price: plainPrice(BigInt(item.defaultPriceAmount), item.defaultPriceCurrency),
      Tax: tax,
      "HSN/SAC code": item.hsnSac ?? "",
      "Income account": account(item.incomeAccountId),
      "Expense account": account(item.expenseAccountId),
    };
  });
}

/** `catalogue-2026-10-10.csv` */
export function exportFileName(today: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `catalogue-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.csv`;
}

/** The Price filter's button: "Price", "₹100.00 – ₹5,000.00", "From ₹100.00" or "Up to ₹5,000.00". */
export function priceLabel(min: string, max: string, currency: string, format: (amount: bigint, currency: string) => string): string {
  const lo = parseDecimalToMinorUnits(min, currency);
  const hi = parseDecimalToMinorUnits(max, currency);
  if (lo !== null && hi !== null) return `${format(lo, currency)} – ${format(hi, currency)}`;
  if (lo !== null) return `From ${format(lo, currency)}`;
  if (hi !== null) return `Up to ${format(hi, currency)}`;
  return "Price";
}

/** "Updated 3 items", "Archived 1 item". */
export function bulkToast(verb: "Updated" | "Archived" | "Restored", count: number): string {
  return `${verb} ${count} ${count === 1 ? "item" : "items"}`;
}
