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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@spine/ui";
import { MoreHorizontal } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import type { CatalogItemUsage } from "@spine/shared";
import { MENU_ICONS } from "../../../lib/menu-icons";
import type { CatalogItem } from "./types";
import { useT } from "../../../lib/i18n";

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
  onDuplicate,
  onChanged,
}: {
  item: CatalogItem;
  onEdit: (item: CatalogItem) => void;
  /** US-CAT-12 — opens Add item filled from this one. */
  onDuplicate?: (item: CatalogItem) => void;
  onChanged: (action: "archived" | "restored" | "deleted", item: CatalogItem) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canEdit = useCanEditOwnership(item.createdByUserId, { own: "catalog.edit_own", others: "catalog.edit_others" });
  const canDelete = useCanEditOwnership(item.createdByUserId, { own: "catalog.delete_own", others: "catalog.delete_others" });
  const canCreate = useCapability("catalog.edit_own");
  const [usage, setUsage] = useState<CatalogItemUsage | null>(null);

  // US-CAT-15: the delete confirmation says how many documents used the item.
  function openConfirm() {
    setUsage(null);
    setConfirmOpen(true);
    apiClient
      .get<CatalogItemUsage>(`/catalog-items/${item.id}/usage`)
      .then(setUsage)
      .catch(() => setUsage(null));
  }

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
      setError(err instanceof Error ? err.message : t("catalog.rowActions.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !canDelete && !(canCreate && onDuplicate)) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("catalog.common.actionsFor", { name: item.name })}
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <DropdownMenuItem onSelect={() => onEdit(item)}>
              <MENU_ICONS.edit aria-hidden />
              {t("catalog.common.edit")}
            </DropdownMenuItem>
          )}
          {canCreate && onDuplicate && (
            <DropdownMenuItem onSelect={() => onDuplicate(item)}>
              <MENU_ICONS.duplicate aria-hidden />
              {t("catalog.rowActions.duplicate")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem disabled={busy} onSelect={handleArchiveOrRestore}>
              {item.archivedAt ? <MENU_ICONS.restore aria-hidden /> : <MENU_ICONS.archive aria-hidden />}
              {item.archivedAt ? t("catalog.common.restore") : t("catalog.common.archive")}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={openConfirm}>
                <MENU_ICONS.delete aria-hidden />
                {t("catalog.common.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalog.rowActions.deleteTitle", { name: item.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {usage && usage.quotes + usage.invoices > 0
                ? t("catalog.rowActions.deleteUsed", { count: usage.quotes + usage.invoices })
                : t("catalog.rowActions.deleteUnused")}
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("catalog.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              {t("catalog.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
