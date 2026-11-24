"use client";

import { useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Spinner } from "@spine/ui";
import { BULK_MAX, type BulkResult } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import type { Invoice } from "./types";
import { t, useT } from "../../../lib/i18n";

/** US-INV-23 — an invoice the bulk reminder will act on: issued, with a balance, not reminded today. */
export function canBulkRemind(invoice: Invoice): boolean {
  return invoice.status === "issued" && BigInt(invoice.balanceDue) > 0n && !invoice.remindedToday;
}

/** "INV-0012: Already reminded today. · INV-0009: Nothing is owed on it." */
export function describeSkipped(skipped: BulkResult["skipped"]): string {
  return skipped.map((s) => t("invoices.bulk.skippedItem", { label: s.label ?? t("invoices.bulk.draftInvoice"), reason: s.reason })).join(" · ");
}

/**
 * US-INV-23/24 (D-097) — the bar over the Invoices list while rows are
 * ticked (`InvoicesBulkSelect`): "<n> selected · <amount> outstanding",
 * "Send reminders (<m>)" counting only eligible invoices (hidden without
 * `invoices.send_reminder`; it asks first, since each customer is emailed),
 * "Download PDFs" (a ZIP of the stored PDFs, drafts skipped) and "Clear".
 */
export function InvoicesBulkBar({
  selected,
  onClear,
  onFinished,
  onFailed,
}: {
  selected: Invoice[];
  onClear: () => void;
  /** A bulk action finished: what to tell the person. */
  onFinished: (title: string, description: string) => void;
  /** It didn't: shown above the list, the selection kept (US-OPS-38). */
  onFailed: (title: string, message: string) => void;
}) {
  const t = useT();
  const canSendReminder = useCapability("invoices.send_reminder");
  const [busy, setBusy] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const eligible = selected.filter(canBulkRemind);
  const currency = selected[0]?.currency ?? "USD";
  const outstanding = selected.filter((i) => i.status === "issued").reduce((sum, i) => sum + BigInt(i.balanceDue), 0n);

  const customers = new Set(eligible.map((i) => i.contactId)).size;
  const skipped = selected.length - eligible.length;

  async function downloadPdfs() {
    if (selected.length > BULK_MAX) {
      onFailed(t("invoices.bulk.tooManyTitle"), t("invoices.bulk.tooManyMessage", { max: BULK_MAX }));
      return;
    }
    setBusy(true);
    try {
      const { blob, headers } = await apiClient.download("/invoices/bulk/pdf", { ids: selected.map((i) => i.id) });
      const filename = filenameFrom(headers, "invoices.zip");
      let skipped: BulkResult["skipped"] = [];
      try {
        skipped = JSON.parse(decodeURIComponent(headers.get("X-Spine-Skipped") ?? "[]"));
      } catch {
        // No list to show; the ZIP still downloaded.
      }
      saveBlob(blob, filename);
      const count = selected.length - skipped.length;
      onFinished(t("invoices.bulk.downloadedPdfs", { count }), skipped.length ? t("invoices.bulk.downloadedSkipped", { filename, skipped: describeSkipped(skipped) }) : filename);
    } catch (err) {
      onFailed(t("invoices.bulk.downloadFailed"), err instanceof Error ? err.message : t("invoices.bulk.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  async function sendReminders() {
    setConfirmSend(false);
    setBusy(true);
    try {
      const result = await apiClient.post<BulkResult>("/invoices/bulk/send-reminders", { ids: selected.map((i) => i.id) });
      const title = result.done.length ? t("invoices.bulk.remindersSent", { count: result.done.length }) : t("invoices.bulk.noRemindersSent");
      onFinished(title, result.skipped.length ? t("invoices.bulk.skipped", { skipped: describeSkipped(result.skipped) }) : t("invoices.bulk.eachCustomerGets"));
    } catch (err) {
      onFailed(t("invoices.bulk.sendFailed"), err instanceof Error ? err.message : t("invoices.bulk.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  return (
    // US-OPS-56: on a phone it sits along the bottom in Select mode, where the tab bar was.
    <div
      role="region"
      aria-label={t("invoices.bulk.regionLabel")}
      data-phone-fullscreen=""
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-inverse-surface px-4 py-3 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[var(--z-sticky-header)] max-md:rounded-none max-md:pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <p className="text-[14px] text-inverse-on-surface">
        <span className="font-semibold">{t("invoices.bulk.selectedCount", { n: selected.length })}</span>
        <span className="text-inverse-on-surface-muted">{t("invoices.bulk.outstanding", { amount: formatMoney(outstanding, currency) })}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canSendReminder && (
          <Button onClick={() => setConfirmSend(true)} disabled={busy || eligible.length === 0}>
            {busy ? <Spinner size="sm" /> : t("invoices.bulk.sendRemindersCount", { n: eligible.length })}
          </Button>
        )}
        <Button variant="secondary" onClick={downloadPdfs} disabled={busy}>
          {t("invoices.bulk.downloadPdfs")}
        </Button>
        <Button variant="ghost" onClick={onClear} className="text-inverse-on-surface hover:bg-inverse-on-surface/10">
          {t("invoices.bulk.clear")}
        </Button>
      </div>
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("invoices.bulk.confirmTitle", { count: eligible.length })}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="confirm-reminders">
              {t("invoices.bulk.confirmCustomers", { count: customers })}
              {skipped > 0 && t("invoices.bulk.confirmSkipped", { count: skipped })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("invoices.bulk.goBack")}</AlertDialogCancel>
            <Button onClick={() => void sendReminders()}>{t("invoices.bulk.sendButton", { count: eligible.length })}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
