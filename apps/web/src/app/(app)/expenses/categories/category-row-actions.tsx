"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCanEditOwnership } from "../../../../lib/capabilities-context";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { ExpenseCategory } from "../types";
import { useT } from "../../../../lib/i18n";

export interface CategoryRowHandlers {
  onEdit: (category: ExpenseCategory) => void;
  onHistory: (category: ExpenseCategory) => void;
  onDone: (title: string, description: string) => void;
  onFailed: (title: string, description: string) => void;
}

/**
 * US-PUR-47 (D-218, D-222) — a category row's menu: Edit, View history,
 * Archive (or Restore) and Delete, each with its icon and right,
 * destructive last. Delete shows only while no expense uses the category;
 * otherwise the menu says to archive it. Archive and Delete ask first.
 */
export function CategoryRowActions({ category, expenseCount, handlers }: { category: ExpenseCategory; expenseCount: number | null; handlers: CategoryRowHandlers }) {
  const t = useT();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canEdit = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.edit_own", others: "expense_categories.edit_others" });
  const canRemove = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.delete_own", others: "expense_categories.delete_others" });
  const archived = Boolean(category.archivedAt);
  const inUse = expenseCount !== null && expenseCount > 0;

  async function archive() {
    const ok = await confirm({
      title: t("expenses.categories.archiveTitle", { name: category.name }),
      description: inUse ? t("expenses.categories.archiveDescriptionInUse", { count: expenseCount! }) : t("expenses.categories.archiveDescription"),
      confirmLabel: t("expenses.categories.archiveConfirm"),
    });
    if (!ok) return;
    try {
      await apiClient.post(`/expense-categories/${category.id}/archive`);
      handlers.onDone(t("expenses.categories.archivedToast", { name: category.name }), t("expenses.categories.archivedToastDescription"));
    } catch (err) {
      handlers.onFailed(t("expenses.categories.archiveFailed", { name: category.name }), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    }
  }

  async function restore() {
    try {
      await apiClient.post(`/expense-categories/${category.id}/restore`);
      handlers.onDone(t("expenses.categories.restoredToast", { name: category.name }), t("expenses.categories.restoredToastDescription"));
    } catch (err) {
      handlers.onFailed(t("expenses.categories.restoreFailed", { name: category.name }), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    }
  }

  async function remove() {
    const ok = await confirm({ title: t("expenses.categories.deleteTitle", { name: category.name }), description: t("expenses.categories.deleteDescription"), confirmLabel: t("expenses.categories.deleteConfirm"), danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/expense-categories/${category.id}`);
      handlers.onDone(t("expenses.categories.deletedToast", { name: category.name }), t("expenses.categories.deletedToastDescription"));
    } catch (err) {
      handlers.onFailed(t("expenses.categories.deleteFailed", { name: category.name }), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("expenses.categories.actionsAria", { name: category.name })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => handlers.onEdit(category)}>
              <MENU_ICONS.edit aria-hidden />
              {t("expenses.common.edit")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => handlers.onHistory(category)}>
            <MENU_ICONS.history aria-hidden />
            {t("expenses.common.viewHistory")}
          </DropdownMenuItem>
          {canRemove && !archived && (
            <DropdownMenuItem onSelect={() => void archive()}>
              <MENU_ICONS.archive aria-hidden />
              {t("expenses.categories.archive")}
            </DropdownMenuItem>
          )}
          {canRemove && archived && (
            <DropdownMenuItem onSelect={() => void restore()}>
              <MENU_ICONS.restore aria-hidden />
              {t("expenses.categories.restore")}
            </DropdownMenuItem>
          )}
          {canRemove && expenseCount !== null && <DropdownMenuSeparator />}
          {canRemove && expenseCount !== null && !inUse && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              {t("expenses.common.delete")}
            </DropdownMenuItem>
          )}
          {canRemove && inUse && (
            <DropdownMenuItem disabled>
              <MENU_ICONS.delete aria-hidden />
              <span className="flex flex-col">
                {t("expenses.common.delete")}
                <span className="text-[11.5px]">{t("expenses.categories.inUse")}</span>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
