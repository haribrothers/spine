"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import {
  Alert,
  AlertDescription,
  Button,
  EmptyState,
  Input,
  Label,
  MultiSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { CSV_FORMULA_CELL, type CatalogBundle, type TaxProfile } from "@spine/shared";
import { ChevronDown, Download, Package, Plus, RefreshCw, Search, Upload, Wallet } from "lucide-react";
import { replaceQuery } from "../../../lib/replace-query";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { saveBlob } from "../../../lib/save-file";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { ImportCatalogDialog } from "./import-catalog-dialog";
import { CatalogBulkBar } from "./catalog-bulk-bar";
import { CatalogItemDrawer } from "./catalog-item-drawer";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CatalogTable } from "./catalog-table";
import {
  EXPORT_COLUMNS,
  catalogQuery,
  catalogStats,
  categoriesNote,
  exportFileName,
  exportRows,
  filterCatalog,
  hasCatalogFilters,
  parseCatalogState,
  priceLabel,
  taxLabel,
  type CatalogListState,
  type SetupFilter,
} from "./catalog-list-state";
import { MakeBundleDialog } from "./make-bundle-dialog";
import type { Account, AccountsByType, CatalogItem, TaxGroupOption, TaxRateOption } from "./types";
import { useToast } from "../../../components/toast-host";
import { ActionError } from "../../../components/action-error";
import { t as translate, useT } from "../../../lib/i18n";

const STATUS_OPTIONS = [
  { value: "active", label: translate("catalog.common.active") },
  { value: "archived", label: translate("catalog.common.archived") },
];

/**
 * The Catalogue › Items body.
 *
 * US-CAT-10 to 15 (D-213): every item (archived too) is loaded once and
 * filtered here, so the stat cards count all active items whatever the
 * filters. "Missing tax rate" and "No income account" are filters; "Total
 * items" clears. Search, status, category, price, setup, sort and page live
 * in the address (D-210), with Refresh and a quiet refresh on coming back
 * after 30 s. Rows can be ticked for a bulk change or a bundle; Export
 * downloads the list as filtered.
 */
export function CatalogExplorer({
  initialDrawerOpen,
  onActiveCountChange,
  onBundleSaved,
}: {
  initialDrawerOpen: boolean;
  onActiveCountChange?: (count: number) => void;
  onBundleSaved?: (bundle: CatalogBundle) => void;
}) {
  const t = useT();
  const canCreate = useCapability("catalog.edit_own");
  const canDelete = useCapability("catalog.delete_own");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CatalogListState>(() => parseCatalogState(new URLSearchParams(searchParams.toString())));
  const [all, setAll] = useState<CatalogItem[] | null>(null);
  const [rates, setRates] = useState<TaxRateOption[]>([]);
  const [groups, setGroups] = useState<TaxGroupOption[]>([]);
  const [accounts, setAccounts] = useState<AccountsByType | null>(null);
  const [gst, setGst] = useState(false);
  const [orgCurrency, setOrgCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [editingItem, setEditingItem] = useState<CatalogItem | undefined>(undefined);
  const [prefill, setPrefill] = useState<CatalogItem | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ min: state.min, max: state.max });
  const loading = useRef(false);
  const showToast = useToast();

  /** Sets part of the list state and writes it to the address; a new filter or page clears the selection. */
  function update(patch: Partial<CatalogListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    const query = catalogQuery(next);
    replaceQuery(pathname, query);
  }

  /** The first load shows the placeholder; a refresh keeps the list on screen. */
  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const items = await apiClient.get<CatalogItem[]>("/catalog-items?includeArchived=true");
      setAll(items);
      setSelected((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(translate("catalog.explorer.updatedAnnouncement"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : translate("catalog.explorer.loadError"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient.get<TaxRateOption[]>("/tax-rates").then(setRates).catch(() => {});
    apiClient.get<TaxGroupOption[]>("/tax-groups").then(setGroups).catch(() => {});
    apiClient.get<AccountsByType>("/org/accounts").then(setAccounts).catch(() => {});
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then((profile) => setGst(profile.country === "IN"))
      .catch(() => {});
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setOrgCurrency(res.value?.code ?? null))
      .catch(() => {});
  }, [load]);

  // Back on the tab after 30 s or more, refresh quietly (D-210).
  useEffect(() => {
    let hiddenAt: number | null = null;
    function onVisibility() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  // "Updated 2 min ago" moves on by itself.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => (all ? catalogStats(all, gst) : null), [all, gst]);
  useEffect(() => {
    if (stats) onActiveCountChange?.(stats.total);
  }, [stats, onActiveCountChange]);

  const items = useMemo(() => (all ? filterCatalog(all, state, gst) : null), [all, state, gst]);
  const rateMap = useMemo(() => new Map(rates.map((r) => [r.id, r])), [rates]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const accountMap = useMemo(() => new Map<string, Account>(Object.values(accounts ?? {}).flat().map((a) => [a.id, a])), [accounts]);
  const selectedItems = useMemo(() => (all ?? []).filter((item) => selected.has(item.id)), [all, selected]);
  const currency = orgCurrency ?? all?.[0]?.defaultPriceCurrency ?? "USD";

  function openCreate() {
    setEditingItem(undefined);
    setPrefill(undefined);
    setDrawerOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setPrefill(undefined);
    setEditingItem(item);
    setDrawerOpen(true);
  }

  // US-OPS-43: `?item=<id>` (a search result) opens that item, then leaves the address.
  const itemParam = searchParams.get("item");
  useEffect(() => {
    if (!itemParam) return;
    apiClient
      .get<CatalogItem>(`/catalog-items/${itemParam}`)
      .then(openEdit)
      .catch(() => {})
      .finally(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete("item");
        replaceQuery(pathname, params.toString());
      });
  }, [itemParam]);

  // US-CAT-12 — Duplicate opens Add item filled from this one.
  function openDuplicate(item: CatalogItem) {
    setEditingItem(undefined);
    setPrefill({ ...item, name: t("catalog.explorer.copyName", { name: item.name }) });
    setDrawerOpen(true);
  }

  function handleSaved(item: CatalogItem, mode: "created" | "updated") {
    void load("refresh");
    showToast(mode === "created" ? t("catalog.explorer.itemCreated") : t("catalog.explorer.itemUpdated"), t("catalog.explorer.itemSavedDescription", { name: item.name }));
  }

  function handleRowChanged(action: "archived" | "restored" | "deleted", item: CatalogItem) {
    void load("refresh");
    if (action === "archived") showToast(t("catalog.explorer.itemArchived"), t("catalog.explorer.itemArchivedDescription", { name: item.name }));
    else if (action === "restored") showToast(t("catalog.explorer.itemRestored"), t("catalog.explorer.itemRestoredDescription", { name: item.name }));
    else showToast(t("catalog.explorer.itemDeleted"), t("catalog.explorer.itemDeletedDescription", { name: item.name }));
  }

  function handleBulkFinished(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    setSelected(new Set());
    void load("refresh");
  }

  // US-CAT-12 — the list as filtered, in Import's columns plus Category.
  function exportCsv() {
    if (!items) return;
    const csv = Papa.unparse({ fields: [...EXPORT_COLUMNS], data: exportRows(items, rateMap, groupMap, accountMap).map((row) => EXPORT_COLUMNS.map((c) => row[c])) }, { escapeFormulae: CSV_FORMULA_CELL });
    const filename = exportFileName(new Date());
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
    showToast(t("catalog.explorer.exportedTitle"), t("catalog.explorer.exportedDescription", { count: items.length, filename }));
  }

  function applyPrice() {
    update({ min: priceDraft.min, max: priceDraft.max });
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const categoryOptions = (stats?.categories ?? []).map((c) => ({ value: c, label: c }));

  const search = (
    <div className="relative w-64">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input
        type="search"
        placeholder={t("catalog.common.searchItems")}
        aria-label={t("catalog.common.searchItems")}
        value={state.q}
        onChange={(event) => update({ q: event.target.value })}
        className="pl-9"
      />
    </div>
  );

  const statButton = (label: string, value: number | null, setup: SetupFilter | null, hint: string, ariaHint: string) => {
    const pressed = setup ? state.setup === setup : false;
    return (
      <button
        type="button"
        aria-pressed={setup ? pressed : undefined}
        aria-label={t("catalog.explorer.statAria", { hint: ariaHint, value: value ?? t("catalog.explorer.statLoading") })}
        onClick={() =>
          setup ? update({ setup: pressed ? "" : setup }) : update({ q: "", status: ["active"], categories: [], min: "", max: "", setup: "" })
        }
        className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <StatCard
          label={label}
          value={value === null ? "—" : String(value)}
          trend={{ direction: "neutral", label: pressed ? t("catalog.explorer.statPressed") : hint }}
          className={cn("h-full transition-colors hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
        />
      </button>
    );
  };

  const filtersOn = hasCatalogFilters(state);
  const priceSet = Boolean(state.min.trim() || state.max.trim());
  const selectable = canCreate || canDelete;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="catalog-stats">
        {statButton(t("catalog.explorer.statTotal"), stats?.total ?? null, null, t("catalog.explorer.statClearHint"), t("catalog.explorer.statClearHint"))}
        <StatCard
          label={t("catalog.explorer.statCategories")}
          value={stats ? String(stats.categories.length) : "—"}
          trend={{ direction: "neutral", label: stats ? categoriesNote(stats.categories) : "" }}
          className="h-full"
        />
        {/* eslint-disable-next-line i18next/no-literal-string -- "tax" is a setup filter value, not copy */}
        {statButton(t("catalog.explorer.statMissingTax"), stats?.missingTax ?? null, "tax", t("catalog.explorer.statMissingTaxHint"), t("catalog.explorer.statMissingTaxAria"))}
        {/* eslint-disable-next-line i18next/no-literal-string -- "account" is a setup filter value, not copy */}
        {statButton(t("catalog.explorer.statNoIncome"), stats?.noIncomeAccount ?? null, "account", t("catalog.explorer.statNoIncomeHint"), t("catalog.explorer.statNoIncomeAria"))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status })} placeholder={t("catalog.explorer.statusPlaceholder")} aria-label={t("catalog.common.filterByStatus")} className="w-36" />
            <MultiSelect
              options={categoryOptions}
              value={state.categories}
              onValueChange={(categories) => update({ categories })}
              placeholder={t("catalog.common.category")}
              aria-label={t("catalog.common.filterByCategory")}
              className="w-40"
            />
            <Popover onOpenChange={(open) => open && setPriceDraft({ min: state.min, max: state.max })}>
              <PopoverTrigger asChild>
                <Button variant="secondary" aria-label={priceSet ? t("catalog.explorer.priceFilterAria", { label: priceLabel(state.min, state.max, currency, formatMoney) }) : t("catalog.explorer.filterByPrice")} className={cn(priceSet && "border-primary text-primary")}>
                  <Wallet size={14} aria-hidden />
                  {priceLabel(state.min, state.max, currency, formatMoney)}
                  <ChevronDown size={14} aria-hidden className="text-on-surface-muted" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyPrice();
                  }}
                >
                  <p className="text-[13px] text-on-surface-muted">{t("catalog.explorer.priceHelp")}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="catalog-price-min">{t("catalog.explorer.min")}</Label>
                      <Input id="catalog-price-min" type="number" inputMode="decimal" min={0} step="0.01" value={priceDraft.min} onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="catalog-price-max">{t("catalog.explorer.max")}</Label>
                      <Input id="catalog-price-max" type="number" inputMode="decimal" min={0} step="0.01" value={priceDraft.max} onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setPriceDraft({ min: "", max: "" });
                        update({ min: "", max: "" });
                      }}
                    >
                      {t("catalog.common.clear")}
                    </Button>
                    <Button type="submit" size="sm">
                      {t("catalog.explorer.apply")}
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={() => update({ q: "", status: ["active"], categories: [], min: "", max: "", setup: "" })}>
                {t("catalog.common.clearFilters")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="catalog-updated">
                {refreshing ? t("catalog.common.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("catalog.common.refreshList")} aria-busy={refreshing} disabled={refreshing || !all} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("catalog.common.refreshList")}</TooltipContent>
            </Tooltip>
            <Button variant="secondary" onClick={exportCsv} disabled={!items || items.length === 0}>
              <Download size={14} aria-hidden />
              {t("catalog.common.export")}
            </Button>
            {canCreate && (
              <>
                {/* US-CAT-09 — import from a CSV; same right as adding an item. */}
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload size={14} aria-hidden />
                  {t("catalog.common.import")}
                </Button>
                <Button onClick={openCreate}>
                  <Plus size={14} aria-hidden />
                  {t("catalog.common.addItem")}
                </Button>
              </>
            )}
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical" data-testid="catalog-refresh-failed">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("catalog.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("catalog.common.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {selectedItems.length > 0 && (
          <CatalogBulkBar
            selected={selectedItems}
            gst={gst}
            categories={stats?.categories ?? []}
            rates={rates}
            groups={groups}
            incomeAccounts={accounts?.income ?? []}
            onClear={() => setSelected(new Set())}
            onMakeBundle={() => setBundleOpen(true)}
            onFinished={handleBulkFinished}
            onFailed={(title, message) => setActionError({ title, message })}
          />
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!items ? (
        <CatalogSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={state.q.trim() ? <Search /> : <Package />}
                title={state.q.trim() && !hasCatalogFilters({ ...state, q: "" }) ? t("catalog.explorer.noMatchQuery", { query: state.q.trim() }) : t("catalog.explorer.noMatchFilters")}
                description={t("catalog.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={() => update({ q: "", status: ["active"], categories: [], min: "", max: "", setup: "" })}>
                    {t("catalog.common.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Package />}
                title={t("catalog.explorer.emptyTitle")}
                description={t("catalog.explorer.emptyDescription")}
                action={canCreate ? <Button onClick={openCreate}>{t("catalog.common.addItem")}</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <CatalogTable
          items={items}
          gst={gst}
          rates={rateMap}
          groups={groupMap}
          selected={selectable ? selected : undefined}
          onSelectedChange={selectable ? setSelected : undefined}
          sort={state.sort}
          onSortChange={(sort) => update({ sort })}
          page={state.page}
          onPageChange={(page) => update({ page })}
          toolbarStart={search}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
          onChanged={handleRowChanged}
        />
      )}

      <CatalogItemDrawer open={drawerOpen} onOpenChange={setDrawerOpen} item={editingItem} prefill={prefill} onSaved={handleSaved} />
      <ImportCatalogDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load("refresh")} />
      <MakeBundleDialog
        items={selectedItems}
        taxText={(item) => taxLabel(item, rateMap, groupMap, gst).text}
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        onSaved={(bundle) => {
          setSelected(new Set());
          showToast(t("catalog.common.bundleSaved"), t("catalog.explorer.bundleSavedDescription", { name: bundle.name }));
          onBundleSaved?.(bundle);
        }}
      />
    </div>
  );
}
