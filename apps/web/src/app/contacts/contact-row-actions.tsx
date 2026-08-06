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
import { apiClient } from "../../lib/api-client";
import type { Contact } from "./types";

/**
 * The row-level "more" menu shared by all three list views (table/list/
 * card) per the task brief — Edit navigates to the detail page (which
 * already has full inline-edit; there's no separate edit surface to build),
 * Archive calls the same endpoint the detail page uses, Delete is behind
 * the same AlertDialog confirmation pattern established there.
 */
export function ContactRowActions({
  contact,
  onChanged,
}: {
  contact: Contact;
  onChanged: (action: "archived" | "restored" | "deleted", contact: Contact) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleArchiveOrRestore() {
    setBusy(true);
    try {
      const wasArchived = Boolean(contact.archivedAt);
      await apiClient.post(`/contacts/${contact.id}/${wasArchived ? "restore" : "archive"}`);
      onChanged(wasArchived ? "restored" : "archived", contact);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/contacts/${contact.id}`);
      setConfirmOpen(false);
      onChanged("deleted", contact);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete contact.");
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
            aria-label={`Actions for ${contact.name}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => router.push(`/contacts/${contact.id}`)}>Edit</DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
            {contact.archivedAt ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the contact and its persons/addresses. This cannot be undone. If this
              contact has any financial ledger history, deletion will be blocked — archive it instead.
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
