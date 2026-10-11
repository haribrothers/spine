"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { formatMoney } from "../../../lib/money";
import { MoneyAccountPicker } from "../../../components/money-account-picker";
import type { Expense } from "./types";

const what = (e: Expense) => `${e.description || e.categoryName || "this expense"} for ${formatMoney(BigInt(e.amount), e.currency)}`;

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
  confirmLabel = "Approve",
}: {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: (updated: Expense) => void;
  confirmLabel?: string;
}) {
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
      setError(err instanceof Error ? err.message : "Couldn't approve this expense.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve this expense?</DialogTitle>
          <DialogDescription>{`${what(expense)} is posted to your books${expense.submittedByName ? `, and ${expense.submittedByName} is told` : ""}. This can't be undone.`}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {open && <MoneyAccountPicker form="expense" direction="out" value={accountId} onValueChange={setAccountId} initialId={expense.moneyAccountId} />}
          <FormField label="Comment" helperText="Optional — the submitter sees it.">
            {(field) => <Input {...field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Matches the site diary." />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Go back
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** US-PUR-09/US-PUR-42 — rejecting asks first and needs a reason the submitter sees; nothing posts. */
export function RejectExpenseDialog({ expense, open, onOpenChange, onRejected }: { expense: Expense; open: boolean; onOpenChange: (open: boolean) => void; onRejected: (updated: Expense) => void }) {
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
      setError("Say why it's rejected, so it can be fixed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Expense>(`/expenses/${expense.id}/reject`, { comment: comment.trim() });
      onOpenChange(false);
      onRejected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reject this expense.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this expense?</DialogTitle>
          <DialogDescription>{`${what(expense)} isn't posted. ${expense.submittedByName ?? "The submitter"} sees why and can fix it and resubmit.`}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField label="Reason" required>
            {(field) => <Input {...field} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why is this being rejected?" />}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Go back
          </Button>
          <Button type="button" variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
