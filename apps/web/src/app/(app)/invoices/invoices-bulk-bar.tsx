"use client";

import { useState } from "react";
import { Button, Spinner } from "@spine/ui";
import { BULK_MAX, type BulkResult } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import type { Invoice } from "./types";

/** US-INV-23 — an invoice the bulk reminder will act on: issued, with a balance, not reminded today. */
export function canBulkRemind(invoice: Invoice): boolean {
  return invoice.status === "issued" && BigInt(invoice.balanceDue) > 0n && !invoice.remindedToday;
}

/** "INV-0012: Already reminded today. · INV-0009: Nothing is owed on it." */
export function describeSkipped(skipped: BulkResult["skipped"]): string {
  return skipped.map((s) => `${s.label ?? "Draft invoice"}: ${s.reason}`).join(" · ");
}

/**
 * US-INV-23/24 (D-097) — the bar over the Invoices list while rows are
 * ticked (`InvoicesBulkSelect`): "<n> selected · <amount> outstanding",
 * "Send reminders (<m>)" counting only eligible invoices (hidden without
 * `invoices.send_reminder`), "Download PDFs" (a ZIP of the stored PDFs,
 * drafts skipped) and "Clear".
 */
export function InvoicesBulkBar({
  selected,
  onClear,
  onFinished,
}: {
  selected: Invoice[];
  onClear: () => void;
  /** A bulk action finished: what to tell the person. */
  onFinished: (title: string, description: string) => void;
}) {
  const canSendReminder = useCapability("invoices.send_reminder");
  const [busy, setBusy] = useState(false);
  const eligible = selected.filter(canBulkRemind);
  const currency = selected[0]?.currency ?? "USD";
  const outstanding = selected.filter((i) => i.status === "issued").reduce((sum, i) => sum + BigInt(i.balanceDue), 0n);

  async function downloadPdfs() {
    if (selected.length > BULK_MAX) {
      onFinished("Too many invoices", `Select ${BULK_MAX} or fewer invoices.`);
      return;
    }
    setBusy(true);
    try {
      const { blob, headers } = await apiClient.download("/invoices/bulk/pdf", { ids: selected.map((i) => i.id) });
      const filename = /filename="([^"]+)"/.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? "invoices.zip";
      let skipped: BulkResult["skipped"] = [];
      try {
        skipped = JSON.parse(decodeURIComponent(headers.get("X-Spine-Skipped") ?? "[]"));
      } catch {
        // No list to show; the ZIP still downloaded.
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      const count = selected.length - skipped.length;
      onFinished(`Downloaded ${count} ${count === 1 ? "PDF" : "PDFs"}`, skipped.length ? `${filename}. Skipped — ${describeSkipped(skipped)}` : filename);
    } catch (err) {
      onFinished("Couldn't download the PDFs", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReminders() {
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/invoices/bulk/send-reminders", { ids: selected.map((i) => i.id) });
      const title = result.done.length ? `${result.done.length} ${result.done.length === 1 ? "reminder" : "reminders"} sent` : "No reminders sent";
      onFinished(title, result.skipped.length ? `Skipped — ${describeSkipped(result.skipped)}` : "Each customer gets the reminder email with the invoice attached.");
    } catch (err) {
      onFinished("Couldn't send the reminders", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label="Selected invoices" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inverse-surface px-4 py-3">
      <p className="text-[14px] text-inverse-on-surface">
        <span className="font-semibold">{selected.length} selected</span>
        <span className="text-inverse-on-surface-muted"> · {formatMoney(outstanding, currency)} outstanding</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canSendReminder && (
          <Button onClick={sendReminders} disabled={busy || eligible.length === 0}>
            {busy ? <Spinner size="sm" /> : `Send reminders (${eligible.length})`}
          </Button>
        )}
        <Button variant="secondary" onClick={downloadPdfs} disabled={busy}>
          Download PDFs
        </Button>
        <Button variant="ghost" onClick={onClear} className="text-inverse-on-surface hover:bg-inverse-on-surface/10">
          Clear
        </Button>
      </div>
    </div>
  );
}
