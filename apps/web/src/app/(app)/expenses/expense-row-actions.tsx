"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, useConfirm } from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { MENU_ICONS } from "../../../lib/menu-icons";
import { useToast } from "../../../components/toast-host";
import { canReviewThis, readyToBill } from "./expense-state";
import type { Expense } from "./types";
import { t as translate, useT } from "../../../lib/i18n";

export interface ExpenseRowHandlers {
  /** An action finished: what to tell the person (D-223). */
  onDone: (title: string, description: string) => void;
  /** It didn't: shown above the list. */
  onFailed: (title: string, message: string) => void;
  onEdit: (expense: Expense) => void;
  onApprove: (expense: Expense) => void;
  onReject: (expense: Expense) => void;
}

export const expenseLabel = (e: Pick<Expense, "number" | "description" | "categoryName">) => e.number ?? e.description ?? e.categoryName ?? translate("expenses.common.expense");

/**
 * US-PUR-42 (D-222, D-227) — an expense row's menu: View; Edit (waiting or
 * rejected, with the right); Approve and Reject (waiting, not my own unless
 * I'm an Owner); Bill to customer (ready to bill); Delete (waiting),
 * destructive last — each with its icon. Bill and Delete ask first here;
 * Approve and Reject open the list's dialogs.
 */
export function ExpenseRowActions({ expense, me, isOwner, handlers }: { expense: Expense; me: string | null; isOwner: boolean; handlers: ExpenseRowHandlers }) {
  const t = useT();
  const router = useRouter();
  const showToast = useToast();
  const { confirm, dialog } = useConfirm();
  const canEditRight = useCanEditOwnership(expense.submittedByUserId, { own: "expenses.edit_own", others: "expenses.edit_others" });
  const canDeleteRight = useCanEditOwnership(expense.submittedByUserId, { own: "expenses.delete_own", others: "expenses.delete_others" });
  const canApproveRight = useCapability("expenses.approve");
  const canRejectRight = useCapability("expenses.reject");
  const canBillRight = useCapability("expenses.bill_to_customer");
  const reviewable = canReviewThis(expense, me, isOwner);
  const canEdit = (expense.status === "submitted" || expense.status === "rejected") && canEditRight;
  const canDelete = expense.status === "submitted" && canDeleteRight;
  const canBill = readyToBill(expense) && !!expense.jobId && canBillRight;
  const label = expenseLabel(expense);
  const amount = formatMoney(BigInt(expense.amount), expense.currency);

  async function bill() {
    const ok = await confirm({
      title: t("expenses.actions.billTitle"),
      description: t("expenses.actions.billDescription", { amount, job: expense.jobName ?? t("expenses.actions.theJob") }),
      confirmLabel: t("expenses.actions.createInvoice"),
    });
    if (!ok) return;
    try {
      const invoice = await apiClient.post<{ id: string; number?: string | null }>(`/expenses/${expense.id}/bill-to-customer`);
      showToast(t("expenses.actions.invoiceDrafted"), t("expenses.actions.invoiceDraftedDescription", { label, amount }));
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      handlers.onFailed(t("expenses.actions.billFailed", { label }), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    }
  }

  async function remove() {
    const ok = await confirm({ title: t("expenses.actions.deleteTitle"), description: t("expenses.actions.deleteDescription", { label, amount }), confirmLabel: t("expenses.actions.deleteExpense"), danger: true });
    if (!ok) return;
    try {
      await apiClient.delete(`/expenses/${expense.id}`);
      handlers.onDone(t("expenses.actions.deleted"), t("expenses.actions.deletedDescription", { label, amount }));
    } catch (err) {
      handlers.onFailed(t("expenses.actions.deleteFailed", { label }), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("expenses.actions.actionsAria", { label })}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/expenses/${expense.id}`)}>
            <MENU_ICONS.view aria-hidden />
            {t("expenses.common.view")}
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onSelect={() => handlers.onEdit(expense)}>
              <MENU_ICONS.edit aria-hidden />
              {expense.status === "rejected" ? t("expenses.common.fixAndResubmit") : t("expenses.common.edit")}
            </DropdownMenuItem>
          )}
          {reviewable && canApproveRight && (
            <DropdownMenuItem onSelect={() => handlers.onApprove(expense)}>
              <MENU_ICONS.approve aria-hidden />
              {t("expenses.common.approve")}
            </DropdownMenuItem>
          )}
          {reviewable && canRejectRight && (
            <DropdownMenuItem onSelect={() => handlers.onReject(expense)}>
              <MENU_ICONS.reject aria-hidden />
              {t("expenses.common.reject")}
            </DropdownMenuItem>
          )}
          {canBill && (
            <DropdownMenuItem onSelect={() => void bill()}>
              <MENU_ICONS.convertToInvoice aria-hidden />
              {t("expenses.common.billToCustomer")}
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem destructive onSelect={() => void remove()}>
              <MENU_ICONS.delete aria-hidden />
              {t("expenses.common.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}
