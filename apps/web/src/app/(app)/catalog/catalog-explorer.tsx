"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, EmptyState, Input, MultiSelect, StatCard } from "@spine/ui";
import { minorUnitExponent } from "@spine/shared/money";
import { Package } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { CatalogItemDrawer } from "./catalog-item-drawer";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CatalogTable } from "./catalog-table";
import type { CatalogItem } from "./types";
import { useEntityToast } from "./entity-toast";
import { useCatalogStats } from "./use-catalog-stats";

const ARCHIVED_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/**
 * Price-range filter compares each item's `defaultPriceAmount` as a plain
 * decimal in its own currency (e.g. "49.99"), not minor units — friendlier
 * to type than cents. Each comparison is scoped to that row's own
 * price/currency pair — the typed bound is converted using *that row's*
 * `minorUnitExponent(currency)` (exact for zero-decimal currencies like
 * JPY too) rather than attempting any cross-currency conversion, which is
 * out of scope per CLAUDE.md's v1 non-goals (no multi-currency); this is a
 * per-row numeric filter, not a cross-currency aggregate.
 */
function parseDecimalToMinorUnits(input: string, currency: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return BigInt(Math.round(value * 10 ** minorUnitExponent(currency)));
}

/**
 * The Catalogue list page's client-side body — kept proportionate to F2's
 * flat-CRUD scope (no view switcher, unlike Contacts' richer Explorer): a
 * stat-card row, a status filter, one table, and a Drawer that handles
 * both create and edit (see CatalogItemDrawer's own comment).
 */
export function CatalogExplorer({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const canCreate = useCapability("catalog.edit_own");
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  // Full (unfiltered) list, independent of statusFilter below — stats must
  // stay correct even when the table itself is scoped to "archived only",
  // matching Contacts' own useContactStats precedent of never deriving
  // stat-card numbers from a filtered view.
  const [allItems, setAllItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [editingItem, setEditingItem] = useState<CatalogItem | undefined>(undefined);
  const { show: showToast, toast } = useEntityToast();
  const stats = useCatalogStats(allItems);

  // Category options come from allItems (org-wide, unfiltered), not the
  // status-filtered `items` — so "Category" always offers every category in
  // use, the same reasoning as the stat cards above.
  const categoryOptions = useMemo(
    () =>
      Array.from(new Set((allItems ?? []).map((item) => item.category).filter((c): c is string => Boolean(c))))
        .sort()
        .map((c) => ({ value: c, label: c })),
    [allItems],
  );

  const filteredItems = useMemo(() => {
    if (!items) return null;
    return items.filter((item) => {
      if (categoryFilter.length && (!item.category || !categoryFilter.includes(item.category))) return false;
      const amount = BigInt(item.defaultPriceAmount);
      const min = parseDecimalToMinorUnits(minPrice, item.defaultPriceCurrency);
      if (min !== null && amount < min) return false;
      const max = parseDecimalToMinorUnits(maxPrice, item.defaultPriceCurrency);
      if (max !== null && amount > max) return false;
      return true;
    });
  }, [items, categoryFilter, minPrice, maxPrice]);

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

  const loadAllItems = useCallback(() => {
    apiClient
      .get<CatalogItem[]>("/catalog-items?includeArchived=true")
      .then(setAllItems)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadAllItems();
  }, [loadAllItems]);

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
    loadAllItems();
    showToast(mode === "created" ? "Item created" : "Item updated", `${item.name} has been saved.`);
  }

  function handleRowChanged(action: "archived" | "restored" | "deleted", item: CatalogItem) {
    loadItems();
    loadAllItems();
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total items" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Categories" value={stats.categories === null ? "—" : String(stats.categories)} />
        <StatCard label="Missing tax rate" value={stats.missingTaxRate === null ? "—" : String(stats.missingTaxRate)} />
        <StatCard
          label="Missing account mapping"
          value={stats.missingAccountMapping === null ? "—" : String(stats.missingAccountMapping)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={ARCHIVED_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            className="w-36"
          />
          <MultiSelect
            options={categoryOptions}
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            placeholder="Category"
            className="w-40"
          />
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Min price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-28"
            />
            <span className="text-[13px] text-on-surface-muted">–</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-28"
            />
          </div>
        </div>
        {canCreate && <Button onClick={openCreate}>Add item</Button>}
      </div>

      {!filteredItems ? (
        <CatalogSkeleton />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length !== 1 ||
          !statusFilter.includes("active") ||
          categoryFilter.length > 0 ||
          minPrice ||
          maxPrice ? (
            <EmptyState
              icon={<Package />}
              title="No items match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter(["active"]);
                    setCategoryFilter([]);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Package />}
              title="No catalogue items yet"
              description="Add your first good or service to quote faster — default price and tax rate prefill every new quote line."
              action={canCreate ? <Button onClick={openCreate}>Add item</Button> : undefined}
            />
          )}
        </div>
      ) : (
        <CatalogTable items={filteredItems} onEdit={openEdit} onChanged={handleRowChanged} />
      )}

      <CatalogItemDrawer open={drawerOpen} onOpenChange={setDrawerOpen} item={editingItem} onSaved={handleSaved} />
      {toast}
    </div>
  );
}
