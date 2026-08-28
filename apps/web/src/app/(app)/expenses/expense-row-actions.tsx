"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import type { Expense } from "./types";

/**
 * Row-level "more" menu, mirroring vendor-bills/vendor-bill-row-actions.tsx's
 * exact pattern. "Edit"/"Delete" only appear for a submitted expense — an
 * approved expense has already posted to the ledger (ExpensesService's own
 * "approval is the posting trigger" rule) and a rejected one is a closed
 * review, so both are immutable per ExpensesService.update/delete's own
 * guards. "View" always opens the detail Drawer, unconditionally (read is
 * always unconditional). Delete additionally needs `expenses.delete_own`/
 * `delete_others` (own vs. others from `expense.submittedByUserId`) — Field
 * always has `delete_own` for their own expense regardless of Team grants
 * (Field is fixed/non-configurable; see `capability.util.ts`'s
 * `FIELD_OWN_CAPABILITIES`).
 */
export function ExpenseRowActions({
  expense,
  onDeleted,
  onOpen,
}: {
  expense: Expense;
  onDeleted: (expense: Expense) => void;
  onOpen: (expense: Expense) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canDelete = useCanEditOwnership(expense.submittedByUserId, { own: "expenses.delete_own", others: "expenses.delete_others" });

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/expenses/${expense.id}`);
      setConfirmOpen(false);
      onDeleted(expense);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this expense.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Actions for this expense"
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => onOpen(expense)}>View</DropdownMenuItem>
          {expense.status === "submitted" && canDelete && (
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the expense. This cannot be undone.
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
