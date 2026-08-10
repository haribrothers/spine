"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Spinner,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../lib/api-client";
import { useEntityToast } from "./entity-toast";
import { EXPENSE_PAID_BY_LABELS, EXPENSE_STATUS_LABELS, type Expense } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_BADGE_CLASS: Record<Expense["status"], string> = {
  submitted: "bg-draft-bg text-draft",
  approved: "bg-paid-bg text-paid",
  rejected: "bg-overdue-bg text-overdue",
};

/**
 * Read-mostly detail Drawer, mirroring payments/payment-detail-drawer.tsx's
 * exact composition. For a `submitted` expense, Approve/Reject are gated to
 * owner/staff — passed in as `canApprove` (this codebase has no client-side
 * capability check finer than role, see jobs/job-detail.tsx's own doc
 * comment on that gap; a Field user who somehow reaches this drawer just
 * won't see the buttons, and the server independently 403s on click
 * regardless). Reject REQUIRES a comment (disable confirm until non-empty,
 * mirroring invoice-detail.tsx's void-reason-required pattern); Approve's
 * comment is optional.
 */
export function ExpenseDetailDrawer({
  open,
  onOpenChange,
  expenseId,
  canApprove,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string | null;
  canApprove: boolean;
  onChanged: () => void;
  onDeleted: (expense: Expense) => void;
}) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { show: showToast, toast } = useEntityToast();

  useEffect(() => {
    if (!open || !expenseId) {
      setExpense(null);
      return;
    }
    setError(null);
    apiClient
      .get<Expense>(`/expenses/${expenseId}`)
      .then(setExpense)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load expense."));
  }, [open, expenseId]);

  async function handleApprove() {
    if (!expense) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Expense>(`/expenses/${expense.id}/approve`, { comment: approveComment || null });
      setExpense(updated);
      setApproveOpen(false);
      setApproveComment("");
      onChanged();
      showToast("Expense approved", "It has been posted to the ledger.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this expense.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!expense) return;
    if (!rejectComment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Expense>(`/expenses/${expense.id}/reject`, { comment: rejectComment.trim() });
      setExpense(updated);
      setRejectOpen(false);
      setRejectComment("");
      onChanged();
      showToast("Expense rejected", "It has not been posted to the ledger.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this expense.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!expense) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/expenses/${expense.id}`);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onDeleted(expense);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this expense.");
    } finally {
      setBusy(false);
    }
  }

  const canReviewNow = canApprove && expense?.status === "submitted";

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              {expense?.number ?? "Expense"}
              {expense && <Badge className={STATUS_BADGE_CLASS[expense.status]}>{EXPENSE_STATUS_LABELS[expense.status]}</Badge>}
            </DrawerTitle>
            <DrawerDescription>{expense?.categoryName ?? "—"}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!expense ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date" value={new Date(expense.date).toLocaleDateString()} />
                  <Field label="Category" value={expense.categoryName ?? "—"} />
                  <Field
                    label="Amount"
                    value={`${toDecimalString({ amount: BigInt(expense.amount), currency: expense.currency })} ${expense.currency}`}
                  />
                  <Field
                    label="Tax"
                    value={`${toDecimalString({ amount: BigInt(expense.taxAmount), currency: expense.currency })} ${expense.currency}`}
                  />
                  <Field label="Paid by" value={EXPENSE_PAID_BY_LABELS[expense.paidBy]} />
                  <Field label="Billable" value={expense.isBillable ? "Yes" : "No"} />
                </div>

                {expense.description && (
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold text-on-surface-muted">Description</h3>
                    <p className="text-[13px] text-on-surface">{expense.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-on-surface-muted">Receipt</h3>
                  {expense.receiptFileId ? (
                    <a
                      href={`${API_URL}/files/${expense.receiptFileId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-primary hover:underline"
                    >
                      View receipt
                    </a>
                  ) : (
                    <p className="text-[13px] text-on-surface-muted">No receipt attached.</p>
                  )}
                </div>

                {expense.reviewComment && (
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold text-on-surface-muted">
                      {expense.status === "rejected" ? "Rejection reason" : "Review comment"}
                    </h3>
                    <p className="text-[13px] text-on-surface">{expense.reviewComment}</p>
                  </div>
                )}
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            {canReviewNow && (
              <Button variant="secondary" onClick={() => setRejectOpen(true)} disabled={busy}>
                Reject
              </Button>
            )}
            {canReviewNow && (
              <Button onClick={() => setApproveOpen(true)} disabled={busy}>
                Approve
              </Button>
            )}
            {expense?.status === "submitted" && (
              <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex flex-col gap-3 pt-2 text-left">
                <p>This posts the expense to the ledger. This cannot be undone.</p>
                <Input value={approveComment} onChange={(e) => setApproveComment(e.target.value)} placeholder="Optional comment" />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApproveComment("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleApprove}>
              {busy ? <Spinner size="sm" /> : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex flex-col gap-3 pt-2 text-left">
                <p>It will never post to the ledger. A comment is required.</p>
                <Input value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Why is this being rejected?" required />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectComment("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !rejectComment.trim()} onClick={handleReject}>
              {busy ? <Spinner size="sm" /> : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the expense. This cannot be undone.
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={handleDelete}>
              {busy ? <Spinner size="sm" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-on-surface-muted">{label}</span>
      <span className="text-[13px] text-on-surface">{value}</span>
    </div>
  );
}
