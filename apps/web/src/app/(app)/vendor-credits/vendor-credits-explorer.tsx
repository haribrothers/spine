"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, ChipStrip, Combobox, EmptyState, FilterSheet, FloatingActionButton, Input, MultiSelect, StatCard, TableSkeleton, Tooltip, TooltipContent, TooltipTrigger, cn, type FilterChip } from "@spine/ui";
import { FileMinus, ListFilter, Plus, RefreshCw, Search } from "lucide-react";
import { useModule } from "../../../lib/modules-context";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { useToast } from "../../../components/toast-host";
import { ActionError } from "../../../components/action-error";
import { t as translate, useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import type { ContactOption, JobOption } from "../vendor-bills/types";
import { ApplyVendorCreditDialog } from "./apply-vendor-credit-dialog";
import { VendorRefundDialog } from "./vendor-refund-dialog";
import { VoidCreditDialog } from "./void-credit-dialog";
import { VendorCreditsTable } from "./vendor-credits-table";
import { VendorCreditsBulkBar } from "./vendor-credits-bulk-bar";
import { creditLabel } from "./vendor-credit-row-actions";
import {
  CREDIT_STATES,
  CREDIT_STATE_LABELS,
  UNUSED_DAYS,
  creditStats,
  filterCredits,
  hasCreditFilters,
  parseVendorCreditsState,
  vendorCreditsQuery,
  type CreditCard,
  type CreditState,
  type VendorCreditsListState,
} from "./vendor-credit-state";
import type { VendorCredit } from "./types";
import { useSelectMode, PhoneMoreActions } from "../../../lib/phone-bar";

const ALL = "__all__";
const STATE_OPTIONS = CREDIT_STATES.map((s) => ({ value: s, label: CREDIT_STATE_LABELS[s] }));
const SKELETON_COLUMNS = [
  { key: "number", header: translate("vendorCredits.columns.number"), width: "w-24" },
  { key: "ref", header: translate("vendorCredits.columns.theirNo"), width: "w-20" },
  { key: "vendor", header: translate("vendorCredits.columns.vendor"), width: "w-40" },
  { key: "date", header: translate("vendorCredits.columns.date"), width: "w-20" },
  { key: "state", header: translate("vendorCredits.columns.state"), width: "w-20" },
  { key: "total", header: translate("vendorCredits.columns.total"), width: "w-24" },
];

/**
 * The Vendor Credits list (US-PUR-38, US-PUR-41, D-226): cards in money —
 * Credit to use, Drafts to record, Partly used, Unused 60+ days (the last
 * three filter) — then the list layout every refined list shares: state,
 * vendor and job on the left of the filter bar with Updated, Refresh and New
 * vendor credit on the right; search and Columns below; newest credit
 * first; state, vendor, job, card, search, sort and page in the address
 * (D-210). Rows act through their menu; ticked drafts can be recorded
 * together.
 */
export function VendorCreditsExplorer() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = useCapability("vendor_credits.edit_own");
  const canRecord = useCapability("vendor_credits.record");
  const jobsOn = useModule("jobsField");
  const isPhone = useIsPhone();
  const [state, setState] = useState<VendorCreditsListState>(() => parseVendorCreditsState(new URLSearchParams(searchParams.toString())));
  const [credits, setCredits] = useState<VendorCredit[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<VendorCredit | null>(null);
  const [refunding, setRefunding] = useState<VendorCredit | null>(null);
  const [voiding, setVoiding] = useState<VendorCredit | null>(null);
  const loading = useRef(false);
  const showToast = useToast();

  function update(patch: Partial<VendorCreditsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    replaceQuery(pathname, vendorCreditsQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const rows = await apiClient.get<VendorCredit[]>("/vendor-credits");
      setCredits(rows);
      setSelected((current) => new Set([...current].filter((id) => rows.some((c) => c.id === id && c.status === "draft"))));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(t("vendorCredits.explorer.updated"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("vendorCredits.explorer.loadFailed"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
  }, [load]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts?picker=1&type=vendor&type=both")
      .then(setContacts)
      .catch(() => {});
    apiClient
      .get<JobOption[]>("/jobs?picker=1")
      .then(setJobs)
      .catch(() => {});
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? null))
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const orgCurrency = currency ?? credits?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (credits ? creditStats(credits, orgCurrency, today) : null), [credits, orgCurrency, today]);
  const rows = useMemo(() => {
    if (!credits) return null;
    const shown = filterCredits(credits, state, today);
    // Newest credit first, unless a column is sorted.
    return state.sort ? shown : [...shown].sort((a, b) => `${b.date.slice(0, 10)}${b.createdAt ?? ""}`.localeCompare(`${a.date.slice(0, 10)}${a.createdAt ?? ""}`));
  }, [credits, state, today]);
  const selectedCredits = useMemo(() => (credits ?? []).filter((c) => selected.has(c.id)), [credits, selected]);
  const vendorOptions = useMemo(() => [{ value: ALL, label: t("vendorCredits.explorer.allVendors") }, ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))], [contacts]);
  const jobOptions = useMemo(() => [{ value: ALL, label: t("vendorCredits.explorer.allJobs") }, ...jobs.map((j) => ({ value: j.id, label: j.name }))], [jobs]);

  /** After an action: what happened (D-223), and the list again. */
  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    void load("refresh");
  }
  const handlers = {
    onDone: done,
    onFailed: (title: string, message: string) => setActionError({ title, message }),
    onApply: (credit: VendorCredit) => setApplying(credit),
    onRefund: (credit: VendorCredit) => setRefunding(credit),
    onVoid: (credit: VendorCredit) => setVoiding(credit),
  };

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (v: bigint) => formatMoney(v, orgCurrency);
  const countOf = (n: number) => t("vendorCredits.explorer.credits", { count: n });
  const card = (key: Exclude<CreditCard, "">, label: string, value: string, hint: string, tone: "default" | "warning" = "default") => {
    const on = state.card === key;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={t("vendorCredits.explorer.showOnly", { label: label.toLowerCase() })}
        onClick={() => update({ card: on ? "" : key })}
        className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <StatCard
          label={label}
          value={value}
          tone={tone}
          trend={{ direction: "neutral", label: on ? t("vendorCredits.explorer.showingThese") : hint }}
          className={cn("h-full transition-colors hover:border-border-strong", on && "border-primary bg-info-bg/60 ring-1 ring-primary")}
        />
        <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", on ? "text-primary" : "text-on-surface-muted")} />
      </button>
    );
  };

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("vendorCredits.explorer.searchPlaceholder")} aria-label={t("vendorCredits.explorer.searchLabel")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasCreditFilters(state);
  const clearAll = () => update({ states: [], vendor: "", job: "", card: "", q: "" });
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const cardNames: Record<string, string> = { drafts: t("vendorCredits.explorer.draftsToRecord"), partly: t("vendorCredits.explorer.partlyUsed"), unused: t("vendorCredits.explorer.unusedDays", { days: UNUSED_DAYS }) };
  const filterChips: FilterChip[] = [
    ...state.states.map((s) => ({ key: `state-${s}`, label: CREDIT_STATE_LABELS[s] ?? s, onRemove: () => update({ states: state.states.filter((x) => x !== s) }) })),
    ...(state.vendor ? [{ key: "vendor", label: vendorOptions.find((o) => o.value === state.vendor)?.label ?? state.vendor, onRemove: () => update({ vendor: "" }) }] : []),
    ...(jobsOn && state.job ? [{ key: "job", label: jobOptions.find((o) => o.value === state.job)?.label ?? state.job, onRemove: () => update({ job: "" }) }] : []),
    ...(state.card ? [{ key: "card", label: cardNames[state.card] ?? state.card, onRemove: () => update({ card: "" }) }] : []),
  ];

  // US-OPS-56: on a phone the top bar's Select shows the ticks; Done clears them.
  const selecting = useSelectMode({ available: Boolean(canRecord), onDone: () => setSelected(new Set()) });
  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="credit-stats">
        <StatCard
          label={t("vendorCredits.explorer.creditToUse")}
          value={stats ? money(stats.toUse.amount) : "—"}
          trend={{ direction: "neutral", label: stats ? t("vendorCredits.explorer.creditToUseTrend", { credits: countOf(stats.toUse.count) }) : t("vendorCredits.explorer.openOrPartlyUsed") }}
          className="h-full"
        />
        {/* eslint-disable i18next/no-literal-string -- card keys and tones, not copy */}
        {card("drafts", t("vendorCredits.explorer.draftsToRecord"), stats ? String(stats.drafts.count) : "—", stats ? t("vendorCredits.explorer.inAll", { amount: money(stats.drafts.amount) }) : "")}
        {card("partly", t("vendorCredits.explorer.partlyUsed"), stats ? money(stats.partly.amount) : "—", stats ? t("vendorCredits.explorer.withSomeLeft", { credits: countOf(stats.partly.count) }) : "")}
        {card(
          "unused",
          t("vendorCredits.explorer.unusedDays", { days: UNUSED_DAYS }),
          stats ? money(stats.unused.amount) : "—",
          stats ? (stats.unused.count ? t("vendorCredits.explorer.askForRefund", { credits: countOf(stats.unused.count) }) : countOf(stats.unused.count)) : "",
          stats && stats.unused.amount > 0n ? "warning" : "default",
        )}
        {/* eslint-enable i18next/no-literal-string */}
      </ChipStrip>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
          {/* US-OPS-57: on a phone, search and Filters in one row, the filters in a sheet. */}
          <FilterSheet
            className="flex flex-wrap items-center gap-2"
            search={isPhone ? search : undefined}
            chips={filterChips}
            onClearAll={clearAll}
            showLabel={rows ? t("vendorCredits.explorer.showCount", { count: rows.length }) : undefined}
          >
            <MultiSelect options={STATE_OPTIONS} value={state.states} onValueChange={(v) => update({ states: v as CreditState[] })} placeholder={t("vendorCredits.explorer.statePlaceholder")} aria-label={t("vendorCredits.explorer.filterByState")} className="w-40" />
            <Combobox options={vendorOptions} value={state.vendor || ALL} onValueChange={(v) => update({ vendor: v === ALL ? "" : v })} placeholder={t("vendorCredits.explorer.allVendors")} aria-label={t("vendorCredits.explorer.filterByVendor")} className="w-56" />
            {/* US-SET-24 */}
            {jobsOn && <Combobox options={jobOptions} value={state.job || ALL} onValueChange={(v) => update({ job: v === ALL ? "" : v })} placeholder={t("vendorCredits.explorer.allJobs")} aria-label={t("vendorCredits.explorer.filterByJob")} className="w-48" />}
            {filtersOn && !isPhone && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("vendorCredits.explorer.clearFilters")}
              </Button>
            )}
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="credits-updated">
                {refreshing ? t("vendorCredits.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <PhoneMoreActions>
              {isPhone ? (
                <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !credits} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden />
                  {t("vendorCredits.explorer.refreshList")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label={t("vendorCredits.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !credits} onClick={() => void load("refresh")}>
                      <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("vendorCredits.explorer.refreshList")}</TooltipContent>
                </Tooltip>
              )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button asChild>
                  <Link href="/vendor-credits/new">
                    <Plus size={14} aria-hidden />
                    {t("vendorCredits.explorer.newVendorCredit")}
                  </Link>
                </Button>
              </FloatingActionButton>
            )}
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("vendorCredits.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("vendorCredits.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <TableSkeleton columns={SKELETON_COLUMNS} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<FileMinus />}
                title={t("vendorCredits.explorer.noMatchTitle")}
                description={t("vendorCredits.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("vendorCredits.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<FileMinus />}
                title={t("vendorCredits.explorer.emptyTitle")}
                description={t("vendorCredits.explorer.emptyDescription")}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/vendor-credits/new">{t("vendorCredits.explorer.newVendorCredit")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {canRecord && selectedCredits.length > 0 && (
            <VendorCreditsBulkBar
              selected={selectedCredits}
              onClear={() => setSelected(new Set())}
              onFinished={(title, description) => {
                setSelected(new Set());
                done(title, description);
              }}
              onFailed={(title, message) => setActionError({ title, message })}
            />
          )}
          <VendorCreditsTable
            credits={rows}
            now={today}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={isPhone ? <span /> : search}
            selected={canRecord ? selected : undefined}
            onSelectedChange={canRecord ? setSelected : undefined}
            phoneSelecting={selecting}
            handlers={handlers}
          />
        </div>
      )}

      {applying && (
        <ApplyVendorCreditDialog
          open
          onOpenChange={(open) => !open && setApplying(null)}
          credit={applying}
          onApplied={(total, bills) => {
            const credit = applying;
            setApplying(null);
            done(t("vendorCredits.applied.title"), t("vendorCredits.applied.description", { amount: formatMoney(total, credit.currency), credit: creditLabel(credit), bills: t("vendorCredits.applied.bills", { count: bills }) }));
          }}
        />
      )}
      {refunding && (
        <VendorRefundDialog
          open
          onOpenChange={(open) => !open && setRefunding(null)}
          credit={refunding}
          onRecorded={(amount) => {
            const credit = refunding;
            setRefunding(null);
            done(t("vendorCredits.applied.refundRecorded"), t("vendorCredits.applied.refundRecordedDescription", { amount: formatMoney(amount, credit.currency), vendor: credit.contactName ?? t("vendorCredits.explorer.theVendor") }));
          }}
        />
      )}
      {voiding && (
        <VoidCreditDialog
          credit={voiding}
          open
          onOpenChange={(open) => !open && setVoiding(null)}
          onVoided={() => {
            const credit = voiding;
            setVoiding(null);
            done(t("vendorCredits.applied.voidedTitle", { credit: creditLabel(credit) }), t("vendorCredits.applied.voidedDescription", { vendor: credit.contactName ?? t("vendorCredits.explorer.theVendor") }));
          }}
        />
      )}
    </div>
  );
}
