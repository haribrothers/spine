"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { Invoice } from "./types";

/**
 * Row-level "more" menu, mirroring quotes/quote-row-actions.tsx exactly.
 * "Edit"/"Delete" only appear for a draft — an issued/void invoice is
 * immutable (InvoicesService.update/delete's own guards), this just avoids
 * offering a dead-end action. "Send reminder" (S-05.10) only appears when
 * `isOverdue` — this is the actual "one click" surface the story's own
 * wording asks for, more so than the detail page's own button, since
 * following up on several overdue invoices from the list is the whole
 * point ("so following up isn't a chore").
 */
export function InvoiceRowActions({
  invoice,
  onDeleted,
  onReminderSent,
  onReminderFailed,
}: {
  invoice: Invoice;
  onDeleted: (invoice: Invoice) => void;
  onReminderSent?: (invoice: Invoice) => void;
  onReminderFailed?: (invoice: Invoice, message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(invoice.createdByUserId, { own: "invoices.edit_own", others: "invoices.edit_others" });
  const canDelete = useCanEditOwnership(invoice.createdByUserId, { own: "invoices.delete_own", others: "invoices.delete_others" });
  const canSendReminder = useCapability("invoices.send_reminder");

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/invoices/${invoice.id}`);
      setConfirmOpen(false);
      onDeleted(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReminder() {
    setBusy(true);
    try {
      await apiClient.post(`/invoices/${invoice.id}/send-reminder`);
      onReminderSent?.(invoice);
    } catch (err) {
      onReminderFailed?.(invoice, err instanceof Error ? err.message : "Could not send this reminder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${invoice.number ?? "this draft invoice"}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoice.id}`)}>View</DropdownMenuItem>
          {invoice.isOverdue && canSendReminder && (
            <DropdownMenuItem disabled={busy} onSelect={handleSendReminder}>
              Send reminder
            </DropdownMenuItem>
          )}
          {invoice.status === "draft" && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoice.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {invoice.status === "draft" && canDelete && (
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft. This cannot be undone.
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
