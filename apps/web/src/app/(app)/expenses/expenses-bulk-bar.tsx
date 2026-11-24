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
import { t as translate, useT } from "../../../lib/i18n";

/** "Fuel · $64.00" — expenses have no number until they're approved. */
function expenseLabel(expense: Expense | undefined): string {
  if (!expense) return translate("expenses.bulk.anExpense");
  return translate("expenses.bulk.label", { category: expense.categoryName ?? translate("expenses.common.expense"), amount: formatMoney(BigInt(expense.amount), expense.currency) });
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
  const t = useT();
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
    const title = n ? (verb === "approved" ? t("expenses.bulk.approved", { count: n }) : t("expenses.bulk.rejected", { count: n })) : verb === "approved" ? t("expenses.bulk.noneApproved") : t("expenses.bulk.noneRejected");
    const skipped = result.skipped.map((s) => t("expenses.bulk.skippedItem", { label: expenseLabel(byId.get(s.id)), reason: s.reason })).join(" · ");
    onFinished(title, skipped ? t("expenses.bulk.skipped", { list: skipped }) : verb === "approved" ? t("expenses.bulk.approvedNote") : t("expenses.bulk.rejectedNote"));
  }

  async function approve() {
    const n = selected.length;
    const ok = await confirm({
      title: t("expenses.bulk.approveTitle", { count: n }),
      description: t("expenses.bulk.approveDescription", { total: formatMoney(total, currency) }),
      confirmLabel: t("expenses.bulk.approveConfirm", { count: n }),
    });
    if (!ok) return;
    setBusy(true);
    try {
      report(await apiClient.post<BulkResult>("/expenses/bulk/approve", { ids: selected.map((e) => e.id) }), "approved");
    } catch (err) {
      onFinished(t("expenses.bulk.approveFailed"), err instanceof Error ? err.message : t("expenses.common.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim()) {
      setCommentError(t("expenses.bulk.commentRequired"));
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/expenses/bulk/reject", { ids: selected.map((e) => e.id), comment: comment.trim() });
      setRejectOpen(false);
      setComment("");
      report(result, "rejected");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : t("expenses.bulk.rejectFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label={t("expenses.bulk.regionAria")} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inverse-surface px-4 py-3">
      <p className="text-[14px] text-inverse-on-surface">
        <span className="font-semibold">{t("expenses.bulk.selected", { n: selected.length })}</span>
        <span className="text-inverse-on-surface-muted">{t("expenses.bulk.total", { amount: formatMoney(total, currency) })}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove && (
          <Button onClick={approve} disabled={busy}>
            {busy && !rejectOpen ? <Spinner size="sm" /> : t("expenses.bulk.approveButton", { n: selected.length })}
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
            {t("expenses.bulk.rejectEllipsis")}
          </Button>
        )}
        <Button variant="ghost" onClick={onClear} className="text-inverse-on-surface hover:bg-inverse-on-surface/10">
          {t("expenses.bulk.clear")}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("expenses.bulk.rejectTitle", { count: selected.length })}
            </DialogTitle>
            <DialogDescription>{t("expenses.bulk.rejectDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label={t("expenses.common.comment")} errorText={commentError}>
              {(field) => <Textarea {...field} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("expenses.bulk.commentPlaceholder")} />}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={busy}>
              {t("expenses.common.cancel")}
            </Button>
            <Button variant="danger" onClick={reject} disabled={busy}>
              {busy ? <Spinner size="sm" /> : t("expenses.bulk.rejectConfirm", { count: selected.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
