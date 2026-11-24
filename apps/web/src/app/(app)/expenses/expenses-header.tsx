"use client";

import Link from "next/link";
import { AppShellHeader, cn } from "@spine/ui";
import { useCapability } from "../../../lib/capabilities-context";
import { t as translate, useT } from "../../../lib/i18n";

/** US-PUR-19 — who may open Expenses › Categories (Owners have every capability). */
export function useCanManageExpenseCategories(): boolean {
  const own = useCapability("expense_categories.edit_own");
  const others = useCapability("expense_categories.edit_others");
  return own || others;
}

export function expensesDescription(canManageCategories: boolean): string {
  return canManageCategories
    ? translate("expenses.header.descriptionWithCategories")
    : translate("expenses.header.description");
}

/**
 * The Expenses page header with its "Expenses" / "Categories" tabs. The
 * Categories tab shows only to members who can manage categories.
 */
export function ExpensesHeader({ active }: { active: "expenses" | "categories" }) {
  const t = useT();
  const canManage = useCanManageExpenseCategories();
  const tabs = [
    { key: "expenses", label: t("expenses.common.expenses"), href: "/expenses" },
    ...(canManage ? [{ key: "categories", label: t("expenses.common.categories"), href: "/expenses/categories" }] : []),
  ];
  return (
    <>
      <AppShellHeader
        breadcrumb={active === "categories" ? [{ label: t("expenses.common.purchases") }, { label: t("expenses.common.expenses"), href: "/expenses" }, { label: t("expenses.common.categories") }] : [{ label: t("expenses.common.purchases") }, { label: t("expenses.common.expenses") }]}
        title={t("expenses.common.expenses")}
        description={expensesDescription(canManage)}
      />
      {tabs.length > 1 && (
        <nav aria-label={t("expenses.header.sectionsAria")} className="mb-4 flex gap-6 border-b border-border">
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
