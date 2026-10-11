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
  useConfirm,
} from "@spine/ui";
import type { QuoteCustomerLink } from "@spine/shared";
import { Copy, Download, Eye, GitBranch, HardHat, Link2, MoreHorizontal, Pencil, Receipt, Send, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { useModule } from "../../../lib/modules-context";
import type { Quote } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** US-QUO-31 — copies a fresh customer link and says so (or shows it when the clipboard is unavailable). */
export async function copyCustomerLink(quoteId: string, notify: (title: string, description: string) => void) {
  try {
    const link = await apiClient.post<QuoteCustomerLink>(`/quotes/${quoteId}/link`);
    try {
      await navigator.clipboard.writeText(link.url);
      notify("Link copied", "It works for 30 days, or until you revise the quote.");
    } catch {
      notify("Here's the customer link", link.url);
    }
  } catch (err) {
    notify("Couldn't make a link", err instanceof Error ? err.message : "Try again.");
  }
}

/**
 * US-QUO-29 (D-214) — a quote row's menu: what you may do next with it.
 * View; Edit, Send and Delete for a draft; Copy customer link, Email again
 * (on its page) and Revise once sent; Convert to invoice or job once
 * accepted; Download PDF and Duplicate for any. Each only with the right,
 * as the API checks (own/others from `createdByUserId`).
 */
export function QuoteRowActions({
  quote,
  onDeleted,
  onNotify,
}: {
  quote: Quote;
  onDeleted: (quote: Quote) => void;
  onNotify: (title: string, description: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(quote.createdByUserId, { own: "quotes.edit_own", others: "quotes.edit_others" });
  const canDelete = useCanEditOwnership(quote.createdByUserId, { own: "quotes.delete_own", others: "quotes.delete_others" });
  const canCreate = useCapability("quotes.edit_own");
  const canSend = useCapability("quotes.send");
  const canRevise = useCapability("quotes.revise");
  const canCreateJob = useCapability("jobs.edit_own");
  const jobsOn = useModule("jobsField");
  const draft = quote.status === "draft";
  const current = !quote.isSuperseded;

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

  async function post(path: string, failure: string) {
    try {
      const next = await apiClient.post<Quote>(path);
      router.push(`/quotes/${next.id}`);
    } catch (err) {
      onNotify(failure, err instanceof Error ? err.message : "Try again.");
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
          <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}`)}>
            <Eye size={14} aria-hidden /> View
          </DropdownMenuItem>
          {draft && canEdit && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}/edit`)}>
              <Pencil size={14} aria-hidden /> Edit
            </DropdownMenuItem>
          )}
          {draft && canSend && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=send`)}>
              <Send size={14} aria-hidden /> Send
            </DropdownMenuItem>
          )}
          {quote.status === "sent" && current && canSend && (
            <DropdownMenuItem onSelect={() => void copyCustomerLink(quote.id, onNotify)}>
              <Link2 size={14} aria-hidden /> Copy customer link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={`${API_URL}/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <Download size={14} aria-hidden /> {draft ? "Preview PDF" : "Download PDF"}
            </a>
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem onSelect={() => void post(`/quotes/${quote.id}/duplicate`, "Couldn't duplicate the quote")}>
              <Copy size={14} aria-hidden /> Duplicate
            </DropdownMenuItem>
          )}
          {quote.status === "accepted" && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=convert-invoice`)}>
              <Receipt size={14} aria-hidden /> Convert to invoice
            </DropdownMenuItem>
          )}
          {quote.status === "accepted" && canCreateJob && jobsOn && (
            <DropdownMenuItem onSelect={() => router.push(`/quotes/${quote.id}?action=convert-job`)}>
              <HardHat size={14} aria-hidden /> Convert to job
            </DropdownMenuItem>
          )}
          {!draft && current && canRevise && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  const ok = await confirm({ title: "Revise this quote?", description: `${quote.number ?? "This quote"} version ${quote.version + 1} is made as a draft from this one. Once it's sent, this version is superseded and the customer can only answer the newest.`, confirmLabel: "Revise quote" });
                  if (ok) void post(`/quotes/${quote.id}/revise`, "Couldn't revise the quote");
                }}
              >
                <GitBranch size={14} aria-hidden /> Revise
              </DropdownMenuItem>
            </>
          )}
          {draft && canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                <Trash2 size={14} aria-hidden /> Delete
              </DropdownMenuItem>
            </>
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
      {confirmDialog}
    </>
  );
}
