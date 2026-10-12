import { describe, expect, it } from "vitest";
import { categoriesQuery, filterCategories, hasCategoryFilters, isLabourCategory, parseCategoriesState, usageFor } from "../app/(app)/expenses/categories/category-state";
import { possessive } from "../app/(app)/expenses/expense-form";
import type { ExpenseCategory } from "../app/(app)/expenses/types";

const category = (over: Partial<ExpenseCategory>): ExpenseCategory =>
  ({
    id: "c",
    orgId: "o",
    name: "Fuel & freight",
    description: "Diesel, petrol, tolls and getting materials to site",
    accountId: "a",
    accountCode: "5400",
    accountName: "Fuel & Freight",
    defaultTaxRateId: null,
    defaultTaxRateName: null,
    createdByUserId: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  }) as ExpenseCategory;

const list = [
  category({ id: "fuel" }),
  category({ id: "materials", name: "Materials", description: "Cement, steel, sand", accountCode: "5000" }),
  category({ id: "labour", name: "Site labour", description: "Daily-wage crews", accountCode: "5200" }),
  category({ id: "old", name: "Client entertainment", description: "Meals and gifts for clients", archivedAt: "2026-10-05T00:00:00Z" }),
];

describe("US-PUR-46 · see every expense category and how it's used", () => {
  it("shows Active by default, Archived or All on request, Active first then by name", () => {
    const state = parseCategoriesState(new URLSearchParams(""));
    expect(filterCategories(list, state).map((c) => c.id)).toEqual(["fuel", "materials", "labour"]);
    expect(filterCategories(list, { ...state, state: "archived" }).map((c) => c.id)).toEqual(["old"]);
    expect(filterCategories(list, { ...state, state: "all" }).map((c) => c.id)).toEqual(["fuel", "materials", "labour", "old"]);
  });

  it("searches the name and what it's for", () => {
    const state = { state: "all" as const, q: "cement" };
    expect(filterCategories(list, state).map((c) => c.id)).toEqual(["materials"]);
    expect(filterCategories(list, { state: "all", q: "GIFTS" }).map((c) => c.id)).toEqual(["old"]);
  });

  it("keeps the filter and search in the address, leaving the default out", () => {
    expect(categoriesQuery({ state: "active", q: "" })).toBe("");
    expect(categoriesQuery({ state: "archived", q: " fuel " })).toBe("state=archived&q=fuel");
    expect(parseCategoriesState(new URLSearchParams("state=archived&q=fuel"))).toEqual({ state: "archived", q: "fuel" });
    expect(parseCategoriesState(new URLSearchParams("state=bogus")).state).toBe("active");
    expect(hasCategoryFilters({ state: "active", q: "" })).toBe(false);
    expect(hasCategoryFilters({ state: "all", q: "" })).toBe(true);
  });

  it("tags the 5200 category for headcount × day rate, and reads 0 for an unused one", () => {
    expect(list.filter(isLabourCategory).map((c) => c.id)).toEqual(["labour"]);
    const usage = [{ categoryId: "fuel", expenseCount: 6, approvedThisMonth: "485000" }];
    expect(usageFor(usage, "fuel")).toEqual({ expenseCount: 6, approvedThisMonth: 485000n });
    expect(usageFor(usage, "materials")).toEqual({ expenseCount: 0, approvedThisMonth: 0n });
    expect(usageFor(null, "fuel")).toBeNull();
  });
});

describe("US-PUR-48 · pick the right category when submitting", () => {
  it("says whose usual rate it is", () => {
    expect(`${possessive("Materials")} usual rate`).toBe("Materials’ usual rate");
    expect(`${possessive("Fuel & freight")} usual rate`).toBe("Fuel & freight’s usual rate");
  });
});
