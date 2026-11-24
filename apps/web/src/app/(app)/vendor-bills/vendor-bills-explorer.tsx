"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, ChipStrip, Combobox, EmptyState, FilterSheet, FloatingActionButton, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn, type FilterChip } from "@spine/ui";
import { ClipboardList, ListFilter, Plus, RefreshCw, Repeat, Search } from "lucide-react";
import { useModule } from "../../../lib/modules-context";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { useToast } from "../../../components/toast-host";
import { useT } from "../../../lib/i18n";
import { useIsPhone } from "../../../lib/use-is-phone";
import { ActionError } from "../../../components/action-error";
import { JobFilter, JobFilterNote, useJobFilter } from "../../../components/job-filter";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { RecordVendorPaymentDialog } from "../vendor-payments/record-vendor-payment-dialog";
import { VendorBillsSkeleton } from "./vendor-bills-skeleton";
import { VendorBillsTable } from "./vendor-bills-table";
import { VendorBillsBulkBar } from "./vendor-bills-bulk-bar";
import { VoidBillDialog } from "./void-bill-dialog";
import {
  BILL_STATES,
  BILL_STATE_LABELS,
  billStats,
  filterBills,
  hasBillFilters,
  parseVendorBillsState,
  vendorBillsQuery,
  type BillCard,
  type BillState,
  type VendorBillsListState,
} from "./vendor-bill-state";
import type { ContactOption, VendorBill } from "./types";
import { useSelectMode, PhoneMoreActions } from "../../../lib/phone-bar";

const ALL_VENDORS = "__all__";
const STATE_OPTIONS = BILL_STATES.map((s) => ({ value: s, label: BILL_STATE_LABELS[s] }));

/**
 * The Vendor Bills list (US-PUR-34, US-PUR-36, D-225): cards in money — To
 * pay, Overdue, Due in 7 days, Drafts to record (the last three filter) —
 * then the list layout every refined list shares: state, vendor and job on
 * the left of the filter bar with Updated, Refresh, Recurring bills and New
 * vendor bill on the right; search and Columns below; newest bill first;
 * state, vendor, job, card, search, sort and page in the address (D-210).
 * Rows act through their menu; ticked drafts can be recorded together.
 */
export function VendorBillsExplorer() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canCreate = useCapability("vendor_bills.edit_own");
  const canManageRecurring = useCapability("vendor_bills.manage_recurring");
  const canRecord = useCapability("vendor_bills.record");
  const canViewCosting = useCapability("reports.view_job_profitability");
  const jobsOn = useModule("jobsField");
  const job = useJobFilter();
  const isPhone = useIsPhone();
  const [state, setState] = useState<VendorBillsListState>(() => parseVendorBillsState(new URLSearchParams(searchParams.toString())));
  const [bills, setBills] = useState<VendorBill[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<VendorBill | null>(null);
  const [voiding, setVoiding] = useState<VendorBill | null>(null);
  const loading = useRef(false);
  const showToast = useToast();
  const jobQuery = job.filtering ? job.jobId : null;

  function update(patch: Partial<VendorBillsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    replaceQuery(pathname, vendorBillsQuery(next, jobQuery));
  }

  const load = useCallback(
    async (mode: "first" | "refresh") => {
      if (loading.current) return;
      loading.current = true;
      if (mode === "refresh") setRefreshing(true);
      try {
        const rows = await apiClient.get<VendorBill[]>(`/vendor-bills${jobQuery ? `?jobId=${jobQuery}` : ""}`);
        setBills(rows);
        setSelected((current) => new Set([...current].filter((id) => rows.some((b) => b.id === id && b.status === "draft"))));
        setRefreshFailed(false);
        setUpdatedAt(Date.now());
        setNow(Date.now());
        if (mode === "refresh") setAnnouncement(t("vendorBills.explorer.updated"));
      } catch (err) {
        if (mode === "first") setError(err instanceof Error ? err.message : t("vendorBills.explorer.loadFailed"));
        else setRefreshFailed(true);
      } finally {
        loading.current = false;
        setRefreshing(false);
      }
    },
    [jobQuery],
  );

  useEffect(() => {
    void load("first");
  }, [load]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts?picker=1&type=vendor&type=both")
      .then(setContacts)
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
  const orgCurrency = currency ?? bills?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (bills ? billStats(bills, orgCurrency, today) : null), [bills, orgCurrency, today]);
  const rows = useMemo(() => {
    if (!bills) return null;
    const shown = filterBills(bills, state, today, (id) => bills.find((b) => b.jobId === id)?.jobName ?? null);
    // Newest bill first, unless a column is sorted.
    return state.sort ? shown : [...shown].sort((a, b) => `${b.date.slice(0, 10)}${b.createdAt}`.localeCompare(`${a.date.slice(0, 10)}${a.createdAt}`));
  }, [bills, state, today]);
  const selectedBills = useMemo(() => (bills ?? []).filter((b) => selected.has(b.id)), [bills, selected]);
  const contactOptions = useMemo(() => [{ value: ALL_VENDORS, label: t("vendorBills.explorer.allVendors") }, ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))], [contacts]);

  /** After an action: what happened (D-223), and the list again. */
  function done(title: string, description: string) {
    setActionError(null);
    showToast(title, description);
    void load("refresh");
  }
  const handlers = {
    onDone: done,
    onFailed: (title: string, message: string) => setActionError({ title, message }),
    onPay: (bill: VendorBill) => setPaying(bill),
    onVoid: (bill: VendorBill) => setVoiding(bill),
  };

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (v: bigint) => formatMoney(v, orgCurrency);
  const countOf = (n: number) => t("vendorBills.explorer.billCount", { count: n });
  const by = stats ? stats.due7.by.toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" }) : "";
  const card = (key: Exclude<BillCard, "">, label: string, value: string, hint: string, tone: "default" | "critical" = "default") => {
    const on = state.card === key;
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={t("vendorBills.explorer.showOnly", { label: label.toLowerCase() })}
        onClick={() => update({ card: on ? "" : key })}
        className="relative rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <StatCard
          label={label}
          value={value}
          tone={tone}
          trend={{ direction: "neutral", label: on ? t("vendorBills.explorer.showingThese") : hint }}
          className={cn("h-full transition-colors hover:border-border-strong", on && "border-primary bg-info-bg/60 ring-1 ring-primary")}
        />
        <ListFilter size={14} aria-hidden className={cn("absolute right-4 top-4", on ? "text-primary" : "text-on-surface-muted")} />
      </button>
    );
  };

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("vendorBills.explorer.searchPlaceholder")} aria-label={t("vendorBills.explorer.searchLabel")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasBillFilters(state) || job.filtering;
  const clearAll = () => {
    update({ states: [], vendor: "", card: "", q: "" });
    if (job.filtering) job.setJobId("__all__");
  };
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const cardNames: Record<string, string> = { overdue: t("vendorBills.explorer.overdue"), due7: t("vendorBills.explorer.due7"), drafts: t("vendorBills.explorer.draftsToRecord") };
  const filterChips: FilterChip[] = [
    ...state.states.map((s) => ({ key: `state-${s}`, label: BILL_STATE_LABELS[s] ?? s, onRemove: () => update({ states: state.states.filter((x) => x !== s) }) })),
    ...(state.vendor ? [{ key: "vendor", label: contactOptions.find((o) => o.value === state.vendor)?.label ?? state.vendor, onRemove: () => update({ vendor: "" }) }] : []),
    ...(jobsOn && job.filtering ? [{ key: "job", label: job.selectedLabel ?? job.jobId, onRemove: () => job.setJobId("__all__") }] : []),
    ...(state.card ? [{ key: "card", label: cardNames[state.card] ?? state.card, onRemove: () => update({ card: "" }) }] : []),
  ];

  // US-OPS-56: on a phone the top bar's Select shows the ticks; Done clears them.
  const selecting = useSelectMode({ available: Boolean(canRecord), onDone: () => setSelected(new Set()) });
  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="bill-stats">
        <StatCard
          label={t("vendorBills.explorer.toPay")}
          value={stats ? money(stats.toPay.amount) : "—"}
          trend={{ direction: "neutral", label: stats ? t("vendorBills.explorer.toPayTrend", { bills: countOf(stats.toPay.count) }) : t("vendorBills.explorer.recordedAndOwed") }}
          className="h-full"
        />
        {/* eslint-disable i18next/no-literal-string -- card keys and tones, not copy */}
        {card("overdue", t("vendorBills.explorer.overdue"), stats ? money(stats.overdue.amount) : "—", stats ? countOf(stats.overdue.count) : "", stats && stats.overdue.amount > 0n ? "critical" : "default")}
        {card("due7", t("vendorBills.explorer.due7"), stats ? money(stats.due7.amount) : "—", stats ? t("vendorBills.explorer.due7Trend", { bills: countOf(stats.due7.count), date: by }) : "")}
        {card("drafts", t("vendorBills.explorer.draftsToRecord"), stats ? String(stats.drafts.count) : "—", stats ? t("vendorBills.explorer.inAll", { amount: money(stats.drafts.amount) }) : "")}
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
            showLabel={rows ? t("vendorBills.explorer.showCount", { count: rows.length }) : undefined}
          >
            <MultiSelect options={STATE_OPTIONS} value={state.states} onValueChange={(v) => update({ states: v as BillState[] })} placeholder={t("vendorBills.explorer.statePlaceholder")} aria-label={t("vendorBills.explorer.filterByState")} className="w-40" />
            <Combobox options={contactOptions} value={state.vendor || ALL_VENDORS} onValueChange={(v) => update({ vendor: v === ALL_VENDORS ? "" : v })} placeholder={t("vendorBills.explorer.allVendors")} aria-label={t("vendorBills.explorer.filterByVendor")} className="w-56" />
            {/* US-SET-24 */}
            {jobsOn && <JobFilter value={job.jobId} options={job.options} onValueChange={job.setJobId} />}
            {filtersOn && !isPhone && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("vendorBills.explorer.clearFilters")}
              </Button>
            )}
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="bills-updated">
                {refreshing ? t("vendorBills.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <PhoneMoreActions>
            {isPhone ? (
              <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !bills} onClick={() => void load("refresh")}>
                <RefreshCw size={16} aria-hidden />
                {t("vendorBills.explorer.refreshList")}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label={t("vendorBills.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !bills} onClick={() => void load("refresh")}>
                    <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("vendorBills.explorer.refreshList")}</TooltipContent>
              </Tooltip>
            )}
            {/* US-PUR-29 — hidden without vendor_bills.manage_recurring, which every /recurring-bills route also checks. */}
            {canManageRecurring && (
              <Button asChild variant="secondary">
                <Link href="/vendor-bills/recurring">
                  <Repeat size={14} aria-hidden />
                  {t("vendorBills.explorer.recurringBills")}
                </Link>
              </Button>
            )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button asChild>
                  <Link href="/vendor-bills/new">
                    <Plus size={14} aria-hidden />
                    {t("vendorBills.explorer.newVendorBill")}
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
              {t("vendorBills.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("vendorBills.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {job.filtering && job.selectedLabel && <JobFilterNote kind="vendor bills" jobId={job.jobId} label={job.selectedLabel} canViewCosting={canViewCosting} />}

      {!rows ? (
        <VendorBillsSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<ClipboardList />}
                title={job.filtering && !hasBillFilters(state) ? t("vendorBills.explorer.noBillsOnJob") : t("vendorBills.explorer.noBillsMatch")}
                description={job.filtering && !hasBillFilters(state) ? t("vendorBills.explorer.jobBillsShowHere") : t("vendorBills.explorer.tryAdjusting")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("vendorBills.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ClipboardList />}
                title={t("vendorBills.explorer.emptyTitle")}
                description={t("vendorBills.explorer.emptyDescription")}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/vendor-bills/new">{t("vendorBills.explorer.newVendorBill")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {canRecord && selectedBills.length > 0 && (
            <VendorBillsBulkBar
              selected={selectedBills}
              onClear={() => setSelected(new Set())}
              onFinished={(title, description) => {
                setSelected(new Set());
                done(title, description);
              }}
              onFailed={(title, message) => setActionError({ title, message })}
            />
          )}
          <VendorBillsTable
            bills={rows}
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

      <RecordVendorPaymentDialog
        open={paying !== null}
        onOpenChange={(open) => !open && setPaying(null)}
        initialContactId={paying?.contactId}
        initialBillId={paying?.id}
        onRecorded={(payment) => {
          const number = payment.number;
          const bill = paying;
          setPaying(null);
          done(number ? t("vendorBills.explorer.paymentNumberRecorded", { number }) : t("vendorBills.explorer.paymentRecorded"), bill ? t("vendorBills.explorer.balanceUpdated", { number: bill.billNumber }) : t("vendorBills.explorer.theBillsBalanceUpdated"));
        }}
      />
      {voiding && (
        <VoidBillDialog
          bill={voiding}
          open
          onOpenChange={(open) => !open && setVoiding(null)}
          onVoided={(updated) => {
            setVoiding(null);
            done(t("vendorBills.explorer.voidedTitle", { number: updated.billNumber }), t("vendorBills.explorer.voidedDescription"));
          }}
        />
      )}
    </div>
  );
}
