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
import type { Invoice } from "./types";

/**
 * Row-level "more" menu, mirroring quotes/quote-row-actions.tsx exactly.
 * "Edit"/"Delete" only appear for a draft — an issued/void invoice is
 * immutable (InvoicesService.update/delete's own guards), this just avoids
 * offering a dead-end action.
 */
export function InvoiceRowActions({ invoice, onDeleted }: { invoice: Invoice; onDeleted: (invoice: Invoice) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
          {invoice.status === "draft" && (
            <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoice.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {invoice.status === "draft" && (
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
            <AlertDialogAction disabled={busy} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
