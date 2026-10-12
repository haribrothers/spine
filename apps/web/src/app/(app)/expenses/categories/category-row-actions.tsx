"use client";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { useCanEditOwnership } from "../../../../lib/capabilities-context";
import { MENU_ICONS } from "../../../../lib/menu-icons";
import type { ExpenseCategory } from "../types";

export interface CategoryRowHandlers {
  onEdit: (category: ExpenseCategory) => void;
  onHistory: (category: ExpenseCategory) => void;
  onDone: (title: string, description: string) => void;
  onFailed: (title: string, description: string) => void;
}

const expensesWord = (n: number) => `${n} expense${n === 1 ? "" : "s"}`;

/**
 * US-PUR-47 (D-218, D-222) — a category row's menu: Edit, View history,
 * Archive (or Restore) and Delete, each with its icon and right,
 * destructive last. Delete shows only while no expense uses the category;
 * otherwise the menu says to archive it. Archive and Delete ask first.
 */
export function CategoryRowActions({ category, expenseCount, handlers }: { category: ExpenseCategory; expenseCount: number | null; handlers: CategoryRowHandlers }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canEdit = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.edit_own", others: "expense_categories.edit_others" });
  const canRemove = useCanEditOwnership(category.createdByUserId, { own: "expense_categories.delete_own", others: "expense_categories.delete_others" });
  const archived = Boolean(category.archivedAt);
  const inUse = expenseCount !== null && expenseCount > 0;

  async function archive() {
    const ok = await confirm({
      title: `Archive ${category.name}?`,
      description: `It leaves the expense form, so no new expense can use it. ${inUse ? `Its ${expensesWord(expenseCount!)} ${expenseCount === 1 ? "keeps" : "keep"} it, and you` : "You"} can restore it at any time.`,
      confirmLabel: "Archive category",
    });
    if (!ok) return;
    try {
      await apiClient.post(`/expense-categories/${category.id}/archive`);
      handlers.onDone(`${category.name} archived`, "It's no longer offered on the expense form. Restore it from Archived.");
    } catch (err) {
      handlers.onFailed(`Couldn't archive ${category.name}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function restore() {
    try {
      await apiClient.post(`/expense-categories/${category.id}/restore`);
      handlers.onDone(`${category.name} restored`, "It's back on the expense form.");
    } catch (err) {
      handlers.onFailed(`Couldn't restore ${category.name}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  async function remove() {
    const ok = await confirm({ title: `Delete ${category.name}?`, description: "No expense uses it, so it's removed for good. This can't be undone.", confirmLabel: "Delete category", danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/expense-categories/${category.id}`);
      handlers.onDone(`${category.name} deleted`, "It's been removed for good.");
    } catch (err) {
      handlers.onFailed(`Couldn't delete ${category.name}.`, err instanceof Error ? err.message : "Try again.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${category.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onSelect={() => handlers.onEdit(category)}>
              <MENU_ICONS.edit aria-hidden />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => handlers.onHistory(category)}>
            <MENU_ICONS.history aria-hidden />
            View history
          </DropdownMenuItem>
          {canRemove && !archived && (
            <DropdownMenuItem onSelect={() => void archive()}>
              <MENU_ICONS.archive aria-hidden />
              Archive
            </DropdownMenuItem>
          )}
          {canRemove && archived && (
            <DropdownMenuItem onSelect={() => void restore()}>
              <MENU_ICONS.restore aria-hidden />
              Restore
            </DropdownMenuItem>
          )}
          {canRemove && expenseCount !== null && <DropdownMenuSeparator />}
          {canRemove && expenseCount !== null && !inUse && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              Delete
            </DropdownMenuItem>
          )}
          {canRemove && inUse && (
            <DropdownMenuItem disabled>
              <MENU_ICONS.delete aria-hidden />
              <span className="flex flex-col">
                Delete
                <span className="text-[11.5px]">In use — archive it instead</span>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
