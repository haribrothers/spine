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
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import type { Quote } from "./types";

/**
 * Row-level "more" menu, following CatalogRowActions' exact pattern. Unlike
 * Catalogue, Quotes DOES have its own detail page (`/quotes/:id`) — the
 * table's Number column already links there (see quotes-table.tsx), so
 * "View" here is a redundant but expected affordance for anyone scanning
 * the actions menu rather than clicking the number cell directly ("View" is
 * always shown — read is unconditional regardless of Team grants). "Edit"
 * only appears for a draft (a sent quote is immutable — see
 * QuotesService.update's own guard; the edit route itself also blocks a
 * non-draft, this is just not offering a dead-end action) AND with
 * `quotes.edit_own`/`edit_others` (own vs. others from
 * `quote.createdByUserId`). "Delete" only appears for a draft too, matching
 * QuotesService.delete's own guard, AND with `quotes.delete_own`/
 * `delete_others`.
 */
export function QuoteRowActions({ quote, onDeleted }: { quote: Quote; onDeleted: (quote: Quote) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(quote.createdByUserId, { own: "quotes.edit_own", others: "quotes.edit_others" });
  const canDelete = useCanEditOwnership(quote.createdByUserId, { own: "quotes.delete_own", others: "quotes.delete_others" });

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/quotes/${quote.id}`);
      setConfirmOpen(false);
      onDeleted(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete quote.");
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
            aria-label={`Actions for ${quote.number ?? "this draft quote"}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}`)}>View</DropdownMenuItem>
          {quote.status === "draft" && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}/edit`)}>Edit</DropdownMenuItem>
          )}
          {quote.status === "draft" && canDelete && (
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft quote?</AlertDialogTitle>
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
