"use client";

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
import type { CatalogItem } from "./types";

/**
 * Row-level "more" menu, following ContactRowActions' exact pattern — Edit
 * opens the same Drawer used for create (owned one level up, in
 * CatalogExplorer), Archive/Restore toggles, Delete is behind the same
 * AlertDialog confirmation. Unlike Contacts, there's no separate detail
 * page to navigate to for Edit — Catalogue's scope is a flat list, so Edit
 * opens the Drawer in-place instead.
 *
 * Edit/Archive/Restore need `catalog.edit_own`/`edit_others`, Delete needs
 * `catalog.delete_own`/`delete_others` (own vs. others resolved from
 * `item.createdByUserId`) — UI convenience only, mirroring what
 * `CatalogService` already enforces server-side.
 */
export function CatalogRowActions({
  item,
  onEdit,
  onChanged,
}: {
  item: CatalogItem;
  onEdit: (item: CatalogItem) => void;
  onChanged: (action: "archived" | "restored" | "deleted", item: CatalogItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(item.createdByUserId, { own: "catalog.edit_own", others: "catalog.edit_others" });
  const canDelete = useCanEditOwnership(item.createdByUserId, { own: "catalog.delete_own", others: "catalog.delete_others" });

  async function handleArchiveOrRestore() {
    setBusy(true);
    try {
      const wasArchived = Boolean(item.archivedAt);
      await apiClient.post(`/catalog-items/${item.id}/${wasArchived ? "restore" : "archive"}`);
      onChanged(wasArchived ? "restored" : "archived", item);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/catalog-items/${item.id}`);
      setConfirmOpen(false);
      onChanged("deleted", item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete item.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${item.name}`}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canEdit && <DropdownMenuItem onSelect={() => onEdit(item)}>Edit</DropdownMenuItem>}
          {canDelete && (
            <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
              {item.archivedAt ? "Restore" : "Archive"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the item. This cannot be undone. Prefer Archive if this item may be
              referenced by a quote or invoice later.
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
