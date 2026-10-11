"use client";

import { useState } from "react";
import { Button, Spinner, useConfirm } from "@spine/ui";
import type { BulkResult } from "@spine/shared";
import { Bell, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { describeSkipped } from "../invoices/invoices-bulk-bar";
import { reminderBlocked } from "./receivables-list-state";
import type { ReceivablesInvoiceRow } from "./types";

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
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const eligible = selected.filter((r) => !reminderBlocked(r));
  const skipped = selected.filter((r) => reminderBlocked(r));
  const customers = new Set(eligible.map((r) => r.contactId)).size;

  async function send() {
    const reminders = `${eligible.length} payment ${eligible.length === 1 ? "reminder" : "reminders"}`;
    const ok = await confirm({
      title: `Send ${reminders}?`,
      description: (
        <span data-testid="confirm-reminders">
          {customers === 1 ? "The customer gets" : "Each customer gets"} the reminder email with the invoice attached, straight away.
          {skipped.length > 0 &&
            ` ${skipped.length} of the selected ${skipped.length === 1 ? "invoice is" : "invoices are"} skipped: ${skipped.map((r) => `${r.number ?? "an invoice"} — ${reminderBlocked(r)!.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}`).join("; ")}.`}
        </span>
      ),
      confirmLabel: eligible.length === 1 ? "Send reminder" : "Send reminders",
      cancelLabel: "Go back",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/invoices/bulk/send-reminders", { ids: eligible.map((r) => r.id) });
      const title = result.done.length ? `${result.done.length} ${result.done.length === 1 ? "reminder" : "reminders"} sent` : "No reminders sent";
      onFinished(title, result.skipped.length ? `Skipped — ${describeSkipped(result.skipped)}` : "Each customer gets the reminder email with the invoice attached.");
    } catch (err) {
      onFailed("Couldn't send the reminders.", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label="Selected invoices" className="flex flex-wrap items-center gap-2 rounded-lg bg-inverse-surface px-3 py-2" data-testid="receivables-bulk-bar">
      <p className="mr-2 pl-1 text-[14px] font-semibold text-inverse-on-surface" aria-live="polite">
        {selected.length} selected
      </p>
      <Button variant="ghost" size="sm" className="text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface" disabled={busy || eligible.length === 0} onClick={() => void send()}>
        <Bell size={14} aria-hidden />
        Send reminders ({eligible.length})
      </Button>
      <span className="flex-1" />
      {busy && <Spinner size="sm" className="text-inverse-on-surface" />}
      <Button variant="ghost" size="sm" className="text-inverse-on-surface hover:bg-inverse-on-surface/10 hover:text-inverse-on-surface" onClick={onClear}>
        <X size={14} aria-hidden />
        Clear
      </Button>
      {dialog}
    </div>
  );
}
