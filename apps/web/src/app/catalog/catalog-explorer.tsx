"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, EmptyState, MultiSelect } from "@spine/ui";
import { Package } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { CatalogItemDrawer } from "./catalog-item-drawer";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CatalogTable } from "./catalog-table";
import type { CatalogItem } from "./types";
import { useEntityToast } from "./entity-toast";

const ARCHIVED_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/**
 * The Catalogue list page's client-side body — kept proportionate to F2's
 * flat-CRUD scope (no stat cards, no view switcher, unlike Contacts'
 * richer Explorer): a status filter, one table, and a Drawer that handles
 * both create and edit (see CatalogItemDrawer's own comment).
 */
export function CatalogExplorer({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [editingItem, setEditingItem] = useState<CatalogItem | undefined>(undefined);
  const { show: showToast, toast } = useEntityToast();

  const loadItems = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter.includes("archived")) params.set("includeArchived", "true");
    const query = params.toString();
    apiClient
      .get<CatalogItem[]>(`/catalog-items${query ? `?${query}` : ""}`)
      .then((rows) => {
        const onlyArchived = statusFilter.includes("archived") && !statusFilter.includes("active");
        setItems(onlyArchived ? rows.filter((row) => row.archivedAt) : rows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load catalogue items."));
  }, [statusFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openCreate() {
    setEditingItem(undefined);
    setDrawerOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditingItem(item);
    setDrawerOpen(true);
  }

  function handleSaved(item: CatalogItem, mode: "created" | "updated") {
    loadItems();
    showToast(mode === "created" ? "Item created" : "Item updated", `${item.name} has been saved.`);
  }

  function handleRowChanged(action: "archived" | "restored" | "deleted", item: CatalogItem) {
    loadItems();
    if (action === "archived") showToast("Item archived", `${item.name} has been archived.`);
    else if (action === "restored") showToast("Item restored", `${item.name} is active again.`);
    else showToast("Item deleted", `${item.name} has been permanently removed.`);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MultiSelect
          options={ARCHIVED_OPTIONS}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          className="w-36"
        />
        <Button onClick={openCreate}>Add item</Button>
      </div>

      {!items ? (
        <CatalogSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length !== 1 || !statusFilter.includes("active") ? (
            <EmptyState
              icon={<Package />}
              title="No items match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button variant="secondary" onClick={() => setStatusFilter(["active"])}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Package />}
              title="No catalogue items yet"
              description="Add your first good or service to quote faster — default price and tax rate prefill every new quote line."
              action={<Button onClick={openCreate}>Add item</Button>}
            />
          )}
        </div>
      ) : (
        <CatalogTable items={items} onEdit={openEdit} onChanged={handleRowChanged} />
      )}

      <CatalogItemDrawer open={drawerOpen} onOpenChange={setDrawerOpen} item={editingItem} onSaved={handleSaved} />
      {toast}
    </div>
  );
}
