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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { Invoice } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * US-INV-29 (D-217) — the row's menu offers what fits the invoice: a draft
 * View, Edit, Issue, Duplicate and Delete; an issued invoice View, Record
 * payment, Email, Send reminder (when overdue), Download PDF, Duplicate
 * and Void — each only with the right to do it. Issue, Record payment,
 * Email, Send reminder and Void open the invoice's page with that step's
 * dialog (`?action=`), so nothing that can't be taken back — issuing,
 * emailing the customer, voiding — happens from one click in the menu.
 * Delete asks here. "Edit"/"Delete" only appear for a draft (an issued or
 * void invoice is immutable); "Send reminder" only when it's overdue.
 */
export function InvoiceRowActions({
  invoice,
  onDeleted,
  onFailed,
}: {
  invoice: Invoice;
  onDeleted: (invoice: Invoice) => void;
  /** Something from the menu couldn't be done (a duplicate, a delete). */
  onFailed?: (invoice: Invoice, message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(invoice.createdByUserId, { own: "invoices.edit_own", others: "invoices.edit_others" });
  const canDelete = useCanEditOwnership(invoice.createdByUserId, { own: "invoices.delete_own", others: "invoices.delete_others" });
  const canSendReminder = useCapability("invoices.send_reminder");
  const canIssue = useCapability("invoices.issue");
  const canSend = useCapability("invoices.send");
  const canVoid = useCapability("invoices.void");
  const canRecordPayment = useCapability("payments.edit_own");
  const canDuplicate = useCapability("invoices.edit_own");
  const balance = invoice.status === "issued" && BigInt(invoice.balanceDue) > 0n;
  const open = (action: string) => router.push(`/invoices/${invoice.id}?action=${action}`);

  async function handleDuplicate() {
    setBusy(true);
    try {
      const copy = await apiClient.post<Invoice>(`/invoices/${invoice.id}/duplicate`);
      router.push(`/invoices/${copy.id}/edit?duplicated=${encodeURIComponent(invoice.number ?? "")}`);
    } catch (err) {
      onFailed?.(invoice, err instanceof Error ? err.message : "Couldn't duplicate this invoice.");
      setBusy(false);
    }
  }

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
          {invoice.status === "draft" && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoice.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {invoice.status === "draft" && canIssue && <DropdownMenuItem onSelect={() => open("issue")}>Issue</DropdownMenuItem>}
          {balance && invoice.type !== "opening" && invoice.type !== "advance" && canRecordPayment && <DropdownMenuItem onSelect={() => open("pay")}>Record payment</DropdownMenuItem>}
          {invoice.status === "issued" && invoice.type !== "opening" && canSend && <DropdownMenuItem onSelect={() => open("email")}>Email invoice</DropdownMenuItem>}
          {invoice.isOverdue && canSendReminder && (
            <DropdownMenuItem onSelect={() => open("remind")}>
              Send reminder
            </DropdownMenuItem>
          )}
          {invoice.status !== "draft" && invoice.type !== "opening" && (
            <DropdownMenuItem asChild>
              <a href={`${API_URL}/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </DropdownMenuItem>
          )}
          {invoice.type !== "opening" && canDuplicate && (
            <DropdownMenuItem disabled={busy} onSelect={() => void handleDuplicate()}>
              Duplicate
            </DropdownMenuItem>
          )}
          {invoice.status === "issued" && invoice.type !== "opening" && canVoid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => open("void")}>
                Void
              </DropdownMenuItem>
            </>
          )}
          {invoice.status === "draft" && canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                Delete
              </DropdownMenuItem>
            </>
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
