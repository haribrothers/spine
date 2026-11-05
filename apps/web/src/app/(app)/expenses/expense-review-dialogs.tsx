"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import type { Expense } from "./types";
import { t as translate, useT } from "../../../lib/i18n";

const what = (e: Expense) => translate("expenses.review.what", { name: e.description || e.categoryName || translate("expenses.review.thisExpense"), amount: formatMoney(BigInt(e.amount), e.currency) });

/**
 * US-PUR-08/US-PUR-42/US-PUR-43 — approving asks first (D-218): it posts the
 * expense, from the account chosen here (US-BANK-03), with an optional
 * comment. Errors stay in the dialog. Used from a row's menu and the page.
 */
export function ApproveExpenseDialog({
  expense,
  open,
  onOpenChange,
  onApproved,
  confirmLabel,
}: {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: (updated: Expense) => void;
  confirmLabel?: string;
}) {
  const t = useT();
  const [comment, setComment] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setComment("");
    setError(null);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Expense>(`/expenses/${expense.id}/approve`, { comment: comment.trim() || null, moneyAccountId: accountId || null });
      onOpenChange(false);
      onApproved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("expenses.review.approveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.review.approveTitle")}</DialogTitle>
          <DialogDescription>{expense.submittedByName ? t("expenses.review.approveDescriptionTold", { what: what(expense), name: expense.submittedByName }) : t("expenses.review.approveDescription", { what: what(expense) })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {open && <MoneyAccountPicker form="expense" direction="out" value={accountId} onValueChange={setAccountId} initialId={expense.moneyAccountId} />}
          <FormField label={t("expenses.common.comment")} helperText={t("expenses.review.commentHelper")}>
            {(field) => <Input {...field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("expenses.review.commentPlaceholder")} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("expenses.common.goBack")}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : (confirmLabel ?? t("expenses.common.approve"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** US-PUR-09/US-PUR-42 — rejecting asks first and needs a reason the submitter sees; nothing posts. */
export function RejectExpenseDialog({ expense, open, onOpenChange, onRejected }: { expense: Expense; open: boolean; onOpenChange: (open: boolean) => void; onRejected: (updated: Expense) => void }) {
  const t = useT();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setComment("");
    setError(null);
  }, [open]);

  async function submit() {
    if (!comment.trim()) {
      setError(t("expenses.review.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Expense>(`/expenses/${expense.id}/reject`, { comment: comment.trim() });
      onOpenChange(false);
      onRejected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("expenses.review.rejectFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.review.rejectTitle")}</DialogTitle>
          <DialogDescription>{t("expenses.review.rejectDescription", { what: what(expense), who: expense.submittedByName ?? t("expenses.review.theSubmitter") })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label={t("expenses.review.reason")} required>
            {(field) => <Input {...field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("expenses.review.reasonPlaceholder")} />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("expenses.common.goBack")}
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : t("expenses.common.reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
