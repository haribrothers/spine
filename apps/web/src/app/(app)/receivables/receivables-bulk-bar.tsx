"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { Bell, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { describeSkipped } from "../invoices/invoices-bulk-bar";
import { reminderBlocked } from "./receivables-list-state";
import type { ReceivablesInvoiceRow } from "./types";
import { useT } from "../../../lib/i18n";

/**
 * US-PAY-28 — the bar over "By invoice" while invoices are ticked:
 * "<n> selected", "Send reminders (<m>)" counting the ones that can go, and
 * Clear. It asks first, naming what it skips and why (D-218); the send is
 * the invoices list's bulk reminder (US-INV-23).
 */
export function ReceivablesBulkBar({
  selected,
  onClear,
  onFinished,
  onFailed,
}: {
  selected: ReceivablesInvoiceRow[];
  onClear: () => void;
  onFinished: (title: string, description: string) => void;
  onFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const eligible = selected.filter((r) => !reminderBlocked(r));
  const skipped = selected.filter((r) => reminderBlocked(r));
  const customers = new Set(eligible.map((r) => r.contactId)).size;

  async function send() {
    const ok = await confirm({
      title: t("receivables.bulk.confirmTitle", { count: eligible.length }),
      description: (
        <span data-testid="confirm-reminders">
          {customers === 1 ? t("receivables.bulk.confirmOne") : t("receivables.bulk.confirmEach")}
          {skipped.length > 0 &&
            t("receivables.bulk.skipped", {
              count: skipped.length,
              list: skipped.map((r) => `${r.number ?? t("receivables.bulk.anInvoice")} — ${reminderBlocked(r)!.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}`).join("; "),
            })}
        </span>
      ),
      confirmLabel: eligible.length === 1 ? t("receivables.bulk.sendReminder") : t("receivables.bulk.sendReminders"),
      cancelLabel: t("receivables.bulk.goBack"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/invoices/bulk/send-reminders", { ids: eligible.map((r) => r.id) });
      const title = result.done.length ? t("receivables.bulk.remindersSent", { count: result.done.length }) : t("receivables.bulk.noRemindersSent");
      onFinished(title, result.skipped.length ? t("receivables.bulk.skippedResult", { skipped: describeSkipped(result.skipped) }) : t("receivables.bulk.eachCustomerGets"));
    } catch (err) {
      onFailed(t("receivables.bulk.sendFailed"), err instanceof Error ? err.message : t("receivables.bulk.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label={t("receivables.bulk.regionLabel")} className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="receivables-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {t("receivables.bulk.selectedCount", { n: selected.length })}
      </p>
      <Button variant="ghost" size="sm" className="text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface" disabled={busy || eligible.length === 0} onClick={() => void send()}>
        <Bell size={14} aria-hidden />
        {t("receivables.bulk.sendRemindersCount", { n: eligible.length })}
      </Button>
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className="text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface" onClick={onClear}>
        <X size={14} aria-hidden />
        {t("receivables.bulk.clear")}
      </Button>
      {dialog}
    </div>
  );
}
