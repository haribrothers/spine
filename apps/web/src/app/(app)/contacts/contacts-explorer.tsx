"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  ChipStrip,
  EmptyState,
  FilterSheet,
  FloatingActionButton,
  Input,
  MultiSelect,
  PaginationBar,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type FilterChip,
} from "@spine/ui";
import { Plus, RefreshCw, Search, Upload, Users } from "lucide-react";
import { replaceQuery } from "../../../lib/replace-query";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { ContactCreateDrawer } from "./contact-create-drawer";
import { ContactsCardView } from "./contacts-card-view";
import { ContactsListView } from "./contacts-list-view";
import { ContactsSkeleton } from "./contacts-skeleton";
import { ContactsTable } from "./contacts-table";
import { ContactsViewSwitcher, VIEW_STORAGE_KEY, type ContactView } from "./contacts-view-switcher";
import { ImportContactsDialog } from "./import/import-contacts-dialog";
import {
  REFRESH_ON_RETURN_MS,
  STAT_TYPES,
  filterContacts,
  hasFilters,
  isTypeSet,
  listStateQuery,
  parseListState,
  updatedLabel,
  type ContactsListState,
} from "./contacts-list-state";
import type { Contact, ContactType, Lead } from "./types";
import { useContactStats } from "./use-contact-stats";
import { useToast } from "../../../components/toast-host";

import { SectionLink } from "../../../components/section-link";
import { t as translate, useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { PhoneMoreActions } from "../../../lib/phone-bar";
const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: translate("contacts.common.typeCustomer") },
  { value: "vendor", label: translate("contacts.common.typeVendor") },
  { value: "both", label: translate("contacts.common.typeBoth") },
];

const ARCHIVED_OPTIONS = [
  { value: "active", label: translate("contacts.common.active") },
  { value: "archived", label: translate("contacts.common.archived") },
];

const DEFAULT_PAGE_SIZE = 25;

/**
 * The Contacts list page's client-side body — stat cards, filters, search,
 * the three views and the create Drawer, all owned here so a create /
 * archive / delete anywhere can refresh the list without a full reload.
 *
 * US-CRM-22/23 (D-210): every contact (archived too) is loaded once and
 * filtered here, so the stat cards count all active contacts whatever the
 * filters, search works in every view, and the import's duplicate check
 * sees archived contacts. Type, status, search and page live in the
 * address; Refresh (and coming back to the tab after 30 s) reloads in
 * place, keeping the list on screen.
 */
export function ContactsExplorer({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const t = useT();
  const canCreate = useCapability("contacts.edit_own");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ContactsListState>(() => parseListState(new URLSearchParams(searchParams.toString())));
  const [all, setAll] = useState<Contact[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [view, setView] = useState<ContactView>("table");
  const isPhone = useIsPhone();
  const [hydrated, setHydrated] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [importOpen, setImportOpen] = useState(false);
  const loading = useRef(false);
  const showToast = useToast();

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "table" || stored === "list" || stored === "card") setView(stored);
    setHydrated(true);
  }, []);

  function handleViewChange(next: ContactView) {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  /** Sets part of the list state and writes it to the address (no history entry per keystroke). */
  function update(patch: Partial<ContactsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    const query = listStateQuery(next);
    replaceQuery(pathname, query);
  }

  /** The first load shows the placeholder; a refresh keeps the list on screen. */
  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const [contacts, leadRows] = await Promise.all([
        apiClient.get<Contact[]>("/contacts?includeArchived=true"),
        apiClient.get<Lead[]>("/leads").catch(() => [] as Lead[]),
      ]);
      setAll(contacts);
      setLeads(leadRows);
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(translate("contacts.explorer.updatedAnnouncement"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : translate("contacts.explorer.loadError"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
  }, [load]);

  // US-CRM-22: back on the tab after 30 s or more, refresh quietly.
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

  const contacts = useMemo(() => (all ? filterContacts(all, state) : null), [all, state]);
  const activeLeadCount = useMemo(() => (leads ? leads.filter((l) => l.stageKind === "open").length : null), [leads]);
  const stats = useContactStats(all, activeLeadCount);

  // List and Card views page here; the Table pages itself with the same page.
  const total = contacts?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(state.page, pageCount);
  const pageRows = contacts ? contacts.slice((page - 1) * pageSize, page * pageSize) : [];

  function handleCreated(contact: Contact) {
    void load("refresh");
    showToast(t("contacts.form.createdTitle"), t("contacts.form.createdDescription", { name: contact.name }));
  }

  function handleRowChanged(action: "archived" | "restored" | "deleted", contact: Contact) {
    void load("refresh");
    if (action === "archived") showToast(t("contacts.detail.archivedTitle"), t("contacts.detail.archivedDescription", { name: contact.name }));
    else if (action === "restored") showToast(t("contacts.detail.restoredTitle"), t("contacts.detail.restoredDescription", { name: contact.name }));
    else showToast(t("contacts.detail.deletedTitle"), t("contacts.detail.deletedDescription", { name: contact.name }));
  }

  function handleImported(createdCount: number) {
    void load("refresh");
    showToast(t("contacts.explorer.importedTitle"), t("contacts.explorer.importedDescription", { count: createdCount }));
  }

  function toggleStatType(set: ContactType[]) {
    update({ types: isTypeSet(state.types, set) ? [] : set });
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const search = (
    <div className="relative w-64">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input
        type="search"
        placeholder={t("contacts.explorer.search")}
        aria-label={t("contacts.explorer.search")}
        value={state.q}
        onChange={(event) => update({ q: event.target.value })}
        className="pl-9"
      />
    </div>
  );

  const statButton = (label: string, value: number | null, set: ContactType[] | null, hint: string) => {
    const pressed = set ? isTypeSet(state.types, set) : false;
    return (
      <button
        type="button"
        aria-pressed={set ? pressed : undefined}
        aria-label={t("contacts.explorer.statAria", { hint, value: value ?? t("contacts.explorer.statLoading") })}
        onClick={() => (set ? toggleStatType(set) : update({ types: [] }))}
        className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <StatCard
          label={label}
          value={value === null ? "—" : String(value)}
          trend={{ direction: "neutral", label: pressed ? t("contacts.explorer.statPressed") : hint }}
          className={cn("h-full transition-colors hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
        />
      </button>
    );
  };

  const filtersOn = hasFilters(state);
  const searching = state.q.trim().length > 0;
  const clearAll = () => update({ types: [], status: ["active"], q: "" });
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone). Status
  // "Active" alone is the default, so it gets no chip; removing the last status goes back to it.
  const defaultStatus = state.status.length === 1 && state.status[0] === "active";
  const filterChips: FilterChip[] = [
    ...state.types.map((type) => ({ key: `type-${type}`, label: TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type, onRemove: () => update({ types: state.types.filter((x) => x !== type) }) })),
    ...(defaultStatus
      ? []
      : state.status.map((status) => ({
          key: `status-${status}`,
          label: ARCHIVED_OPTIONS.find((o) => o.value === status)?.label ?? status,
          onRemove: () => {
            const rest = state.status.filter((s) => s !== status);
            update({ status: rest.length > 0 ? rest : ["active"] });
          },
        }))),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="contact-stats">
        {statButton(t("contacts.explorer.statTotal"), stats.total, null, t("contacts.explorer.statTotalHint"))}
        {statButton(t("contacts.explorer.statCustomers"), stats.customers, STAT_TYPES.customers, t("contacts.explorer.statCustomersHint"))}
        {statButton(t("contacts.explorer.statVendors"), stats.vendors, STAT_TYPES.vendors, t("contacts.explorer.statVendorsHint"))}
        <SectionLink href="/leads" aria-label={t("contacts.explorer.pipelineAria", { count: stats.activeLeads ?? t("contacts.explorer.statLoading") })} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <StatCard
            label={t("contacts.explorer.statActiveLeads")}
            value={stats.activeLeads === null ? "—" : String(stats.activeLeads)}
            trend={{ direction: "neutral", label: t("contacts.explorer.openPipeline") }}
            className="h-full transition-colors hover:border-border-strong"
          />
        </SectionLink>
      </ChipStrip>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* US-OPS-57: on a phone, search and Filters in one row, the filters in a sheet. */}
          <FilterSheet
            className="flex flex-wrap items-center gap-2"
            search={isPhone ? search : undefined}
            chips={filterChips}
            onClearAll={clearAll}
            showLabel={contacts ? t("contacts.explorer.showCount", { count: contacts.length }) : undefined}
          >
            <MultiSelect
              options={TYPE_OPTIONS}
              value={state.types}
              onValueChange={(types) => update({ types: types as ContactType[] })}
              placeholder={t("contacts.explorer.allTypes")}
              aria-label={t("contacts.explorer.filterByType")}
              className="w-44"
            />
            <MultiSelect
              options={ARCHIVED_OPTIONS}
              value={state.status}
              onValueChange={(status) => update({ status })}
              placeholder={t("contacts.explorer.statusPlaceholder")}
              aria-label={t("contacts.explorer.filterByStatus")}
              className="w-36"
            />
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="contacts-updated">
                {refreshing ? t("contacts.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <PhoneMoreActions>
              {isPhone ? (
                <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !all} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden />
                  {t("contacts.explorer.refreshList")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={t("contacts.explorer.refreshList")}
                      aria-busy={refreshing}
                      disabled={refreshing || !all}
                      onClick={() => void load("refresh")}
                    >
                      <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("contacts.explorer.refreshList")}</TooltipContent>
                </Tooltip>
              )}
              {/* US-OPS-56: on a phone contacts are always rows, so the switcher isn't offered. */}
              {isPhone ? null : <ContactsViewSwitcher value={hydrated ? view : "table"} onChange={handleViewChange} />}
              {canCreate && !isPhone && <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />}
              {canCreate && (
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload size={14} />
                  {t("contacts.explorer.importCsv")}
                </Button>
              )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button onClick={() => setDrawerOpen(true)}>
                  {/* The floating button shrinks to its icon while the page scrolls; the desktop button has none. */}
                  {isPhone && <Plus size={14} aria-hidden />}
                  {t("contacts.explorer.addContact")}
                </Button>
              </FloatingActionButton>
            )}
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical" data-testid="contacts-refresh-failed">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("contacts.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("contacts.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {!contacts ? (
        <ContactsSkeleton view={hydrated ? view : "table"} />
      ) : contacts.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Users />}
                title={t("contacts.explorer.noMatchFilters")}
                description={t("contacts.explorer.noMatchFiltersDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("contacts.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : searching ? (
              <EmptyState
                icon={<Search />}
                title={t("contacts.explorer.noMatchQuery", { query: state.q.trim() })}
                description={t("contacts.explorer.noMatchQueryDescription")}
                action={
                  <Button variant="secondary" onClick={() => update({ q: "" })}>
                    {t("contacts.explorer.clearSearch")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users />}
                title={t("contacts.explorer.emptyTitle")}
                description={t("contacts.explorer.emptyDescription")}
                action={canCreate ? <Button onClick={() => setDrawerOpen(true)}>{t("contacts.explorer.addContact")}</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : view === "table" || isPhone ? (
        <ContactsTable contacts={contacts} onChanged={handleRowChanged} page={state.page} onPageChange={(next) => update({ page: next })} toolbarStart={isPhone ? <span /> : search} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          {view === "list" ? <ContactsListView contacts={pageRows} onChanged={handleRowChanged} /> : <ContactsCardView contacts={pageRows} onChanged={handleRowChanged} />}
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(next) => update({ page: next })}
            onPageSizeChange={(size) => {
              setPageSize(size);
              update({ page: 1 });
            }}
          />
        </div>
      )}

      <ContactCreateDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onCreated={handleCreated} />
      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} existingContacts={all ?? []} onImported={handleImported} />
    </div>
  );
}
