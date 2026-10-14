"use client";

import Link from "next/link";
import { AppShellHeader, cn } from "@spine/ui";
import { useCapability } from "../../../lib/capabilities-context";

/** US-PUR-19 — who may open Expenses › Categories (Owners have every capability). */
export function useCanManageExpenseCategories(): boolean {
  const own = useCapability("expense_categories.edit_own");
  const others = useCapability("expense_categories.edit_others");
  return own || others;
}

export function expensesDescription(canManageCategories: boolean): string {
  return canManageCategories
    ? "Submit an expense for approval. Categories are managed from Expenses › Categories."
    : "Submit an expense for approval.";
}

/**
 * The Expenses page header with its "Expenses" / "Categories" tabs. The
 * Categories tab shows only to members who can manage categories.
 */
export function ExpensesHeader({ active }: { active: "expenses" | "categories" }) {
  const canManage = useCanManageExpenseCategories();
  const tabs = [
    { key: "expenses", label: "Expenses", href: "/expenses" },
    ...(canManage ? [{ key: "categories", label: "Categories", href: "/expenses/categories" }] : []),
  ];
  return (
    <>
      <AppShellHeader
        breadcrumb={active === "categories" ? [{ label: "Purchases" }, { label: "Expenses", href: "/expenses" }, { label: "Categories" }] : [{ label: "Purchases" }, { label: "Expenses" }]}
        title="Expenses"
        description={expensesDescription(canManage)}
      />
      {tabs.length > 1 && (
        <nav aria-label="Expenses sections" className="mb-4 flex gap-6 border-b border-border">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-0.5 pb-2 text-[14px] font-medium",
                tab.key === active ? "border-primary text-primary" : "border-transparent text-on-surface-muted hover:text-on-surface",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
