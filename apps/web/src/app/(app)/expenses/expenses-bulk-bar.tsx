"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Spinner,
  Textarea,
  useConfirm,
} from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import type { Expense } from "./types";

/** "Fuel · $64.00" — expenses have no number until they're approved. */
function expenseLabel(expense: Expense | undefined): string {
  if (!expense) return "An expense";
  return `${expense.categoryName ?? "Expense"} · ${formatMoney(BigInt(expense.amount), expense.currency)}`;
}

/**
 * US-PUR-21 (D-097) — the bar over the Expenses list while submitted
 * expenses are ticked (`ExpensesBulkSelect`): "<n> selected · <amount>",
 * "Approve (<n>)", "Reject…" (one comment for all of them) and "Clear".
 * Each expense is reviewed exactly as it would be on its own.
 */
export function ExpensesBulkBar({
  selected,
  onClear,
  onFinished,
}: {
  selected: Expense[];
  onClear: () => void;
  onFinished: (title: string, description: string) => void;
}) {
  const canApprove = useCapability("expenses.approve");
  const canReject = useCapability("expenses.reject");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | undefined>();
  const currency = selected[0]?.currency ?? "USD";
  const total = selected.reduce((sum, e) => sum + BigInt(e.amount), 0n);
  const byId = new Map(selected.map((e) => [e.id, e]));

  function report(result: BulkResult, verb: "approved" | "rejected") {
    const n = result.done.length;
    const title = n ? `${n} ${n === 1 ? "expense" : "expenses"} ${verb}` : `No expenses ${verb}`;
    const skipped = result.skipped.map((s) => `${expenseLabel(byId.get(s.id))}: ${s.reason}`).join(" · ");
    onFinished(title, skipped ? `Skipped — ${skipped}` : verb === "approved" ? "Each one is posted to the books." : "Each submitter can see your comment.");
  }

  async function approve() {
    const n = selected.length;
    const ok = await confirm({
      title: `Approve ${n} ${n === 1 ? "expense" : "expenses"}?`,
      description: `${formatMoney(total, currency)} is posted to your books, each expense as it would be on its own. An approved expense can't be edited.`,
      confirmLabel: n === 1 ? "Approve expense" : "Approve expenses",
    });
    if (!ok) return;
    setBusy(true);
    try {
      report(await apiClient.post<BulkResult>("/expenses/bulk/approve", { ids: selected.map((e) => e.id) }), "approved");
    } catch (err) {
      onFinished("Couldn't approve the expenses", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim()) {
      setCommentError("Add a comment — it's sent with every rejected expense.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/expenses/bulk/reject", { ids: selected.map((e) => e.id), comment: comment.trim() });
      setRejectOpen(false);
      setComment("");
      report(result, "rejected");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Couldn't reject the expenses. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label="Selected expenses" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inverse-surface px-4 py-3">
      <p className="text-[14px] text-inverse-on-surface">
        <span className="font-semibold">{selected.length} selected</span>
        <span className="text-inverse-on-surface-muted"> · {formatMoney(total, currency)}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <Button onClick={approve} disabled={busy}>
            {busy && !rejectOpen ? <Spinner size="sm" /> : `Approve (${selected.length})`}
          </Button>
        )}
        {canReject && (
          <Button
            variant="secondary"
            onClick={() => {
              setCommentError(undefined);
              setRejectOpen(true);
            }}
            disabled={busy}
          >
            Reject…
          </Button>
        )}
        <Button variant="ghost" onClick={onClear} className="text-inverse-on-surface hover:bg-inverse-on-surface/10">
          Clear
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {selected.length} {selected.length === 1 ? "expense" : "expenses"}?
            </DialogTitle>
            <DialogDescription>Your comment goes with every one of them, so the people who submitted them know what to fix.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Comment" errorText={commentError}>
              {(field) => <Textarea {...field} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Attach the receipt and resubmit." />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} disabled={busy}>
              {busy ? <Spinner size="sm" /> : `Reject ${selected.length === 1 ? "expense" : "expenses"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
