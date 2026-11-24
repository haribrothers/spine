"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, ChipStrip, Combobox, EmptyState, FilterSheet, FloatingActionButton, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn, type FilterChip } from "@spine/ui";
import { Plus, Receipt, RefreshCw, Repeat, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { useToast } from "../../../components/toast-host";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { InvoicesTable } from "./invoices-table";
import { InvoicesBulkBar } from "./invoices-bulk-bar";
import {
  INVOICE_STATE_LABELS,
  filterInvoices,
  hasInvoiceFilters,
  invoiceContacts,
  invoiceStats,
  invoicesQuery,
  paidThisMonth,
  parseInvoicesState,
  type InvoiceCard,
  type InvoiceState,
  type InvoicesListState,
  type MoneySum,
  type PaymentForStats,
} from "./invoices-list-state";
import type { Invoice } from "./types";
import { ActionError } from "../../../components/action-error";
import { useT } from "../../../lib/i18n";
import { PhoneMoreActions, useSelectMode } from "../../../lib/phone-bar";
import { useIsPhone } from "../../../lib/use-is-phone";

const STATUS_OPTIONS = (Object.keys(INVOICE_STATE_LABELS) as InvoiceState[]).map((value) => ({ value, label: INVOICE_STATE_LABELS[value] }));
const ALL_CONTACTS = "__all__";

/**
 * The Invoices list page's client-side body.
 *
 * US-INV-27 to US-INV-29 (D-217): cards for Outstanding, Overdue and Due
 * in 7 days (balance totals, each a filter) and Paid this month; every
 * invoice loaded once and filtered here; search, status, contact, card,
 * sort and page in the address (D-210), with Refresh and a quiet refresh
 * after 30 s away. Ticked rows get the bulk bar (US-INV-23); the
 * dashboard's "Send reminder" for several overdue invoices opens
 * `?status=overdue&select=overdue`, filtered, with them ticked (US-DASH-13).
 */
export function InvoicesExplorer() {
  const t = useT();
  const canCreate = useCapability("invoices.edit_own");
  const canManageRecurring = useCapability("invoices.manage_recurring");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<InvoicesListState>(() => parseInvoicesState(new URLSearchParams(searchParams.toString())));
  const selectOverdue = searchParams.get("select") === "overdue";
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [payments, setPayments] = useState<PaymentForStats[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isPhone = useIsPhone();
  // US-OPS-56: on a phone the top bar's Select shows the ticks; Done clears them.
  const selecting = useSelectMode({ available: true, onDone: () => setSelectedIds(new Set()) });
  const loading = useRef(false);
  const showToast = useToast();

  /** Sets part of the list state and writes it to the address. */
  function update(patch: Partial<InvoicesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, invoicesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setInvoices(await apiClient.get<Invoice[]>("/invoices"));
      apiClient
        .get<PaymentForStats[]>("/payments")
        .then(setPayments)
        .catch(() => setPayments([]));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(t("invoices.explorer.updatedAnnouncement"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("invoices.explorer.loadFailed"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load("first");
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? null))
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // US-DASH-13: the overdue invoices start ticked.
  const preselected = useRef(false);
  useEffect(() => {
    if (!selectOverdue || preselected.current || !invoices) return;
    setSelectedIds(new Set(invoices.filter((i) => i.isOverdue).map((i) => i.id)));
    preselected.current = true;
  }, [selectOverdue, invoices]);

  const today = useMemo(() => new Date(now), [now]);
  const orgCurrency = currency ?? invoices?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (invoices ? invoiceStats(invoices, orgCurrency, today) : null), [invoices, orgCurrency, today]);
  const paid = useMemo(() => (payments ? paidThisMonth(payments, orgCurrency, today) : null), [payments, orgCurrency, today]);
  const rows = useMemo(() => (invoices ? filterInvoices(invoices, state, today) : null), [invoices, state, today]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: t("invoices.explorer.allContacts") }, ...invoiceContacts(invoices ?? [])], [invoices, t]);
  // US-INV-23 — ticked rows still on the list (a deleted invoice drops out).
  const selectedInvoices = useMemo(() => (invoices ?? []).filter((i) => selectedIds.has(i.id)), [invoices, selectedIds]);

  function toggleSelected(invoice: Invoice, on: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (on) next.add(invoice.id);
      else next.delete(invoice.id);
      return next;
    });
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.otherCurrencies ? t("invoices.explorer.otherCurrencies", { amount: formatMoney(s.amount, orgCurrency) }) : formatMoney(s.amount, orgCurrency));
  const countOf = (n: number, noun: "invoice" | "payment") => (noun === "payment" ? t("invoices.explorer.paymentCount", { count: n }) : t("invoices.explorer.invoiceCount", { count: n }));

  const card = (label: string, sum: MoneySum | null, key: InvoiceCard | null, hint: string, ariaHint: string, tone: "default" | "warning" | "critical" = "default", noun: "invoice" | "payment" = "invoice") => {
    const pressed = key ? state.card === key : false;
    const inner = (
      <StatCard
        label={label}
        value={sum ? money(sum) : "—"}
        detail={sum ? countOf(sum.count, noun) : undefined}
        tone={sum && sum.count > 0 ? tone : "default"}
        trend={{ direction: "neutral", label: pressed ? t("invoices.explorer.showingThese") : hint }}
        className={cn("h-full transition-colors", key && "hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!key) return inner;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={t("invoices.explorer.cardAria", { hint: ariaHint, count: sum ? sum.count : 0 })}
        onClick={() => update({ card: pressed ? "" : key })}
        className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {inner}
      </button>
    );
  };

  const search = (
    <div className="relative w-72">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("invoices.explorer.searchPlaceholder")} aria-label={t("invoices.explorer.searchAria")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  const filtersOn = hasInvoiceFilters(state);
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const cardNames: Record<string, string> = { outstanding: t("invoices.explorer.cardOutstanding"), overdue: t("invoices.explorer.cardOverdue"), due7: t("invoices.explorer.cardDue7") };
  const filterChips: FilterChip[] = [
    ...state.status.map((status) => ({ key: `status-${status}`, label: STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status, onRemove: () => update({ status: state.status.filter((s) => s !== status) }) })),
    ...(state.contact ? [{ key: "contact", label: contactOptions.find((o) => o.value === state.contact)?.label ?? state.contact, onRemove: () => update({ contact: "" }) }] : []),
    ...(state.card ? [{ key: "card", label: cardNames[state.card] ?? state.card, onRemove: () => update({ card: "" }) }] : []),
  ];
  const clearAll = () => update({ q: "", status: [], contact: "", card: "" });
  // The first of this month in the business's locale ("1 Oct", "Oct 1"). Shown once payments load, in the
  // browser, so the server's HTML (no payments yet) never carries a date that could differ from the client's.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });

  const outstandingCard = card(t("invoices.explorer.cardOutstanding"), stats?.outstanding ?? null, "outstanding", t("invoices.explorer.showTheseInvoices"), t("invoices.explorer.showOutstanding"));
  const overdueCard = card(t("invoices.explorer.cardOverdue"), stats?.overdue ?? null, "overdue", t("invoices.explorer.showTheseInvoices"), t("invoices.explorer.showOverdue"), "critical");
  const due7Card = card(t("invoices.explorer.cardDue7"), stats?.due7 ?? null, "due7", t("invoices.explorer.showTheseInvoices"), t("invoices.explorer.showDue7"), "warning");
  const paidCard = card(t("invoices.explorer.cardPaidThisMonth"), paid, null, paid ? t("invoices.explorer.receivedSince", { date: monthStart }) : t("invoices.explorer.receivedThisMonth"), "", "default", "payment");

  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="invoice-stats">
        {outstandingCard}
        {overdueCard}
        {due7Card}
        {paidCard}
      </ChipStrip>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* US-OPS-57: on a phone, search and Filters in one row, the filters in a sheet. */}
          <FilterSheet
            className="flex flex-wrap items-center gap-2"
            search={isPhone ? search : undefined}
            chips={filterChips}
            onClearAll={clearAll}
            showLabel={rows ? t("invoices.explorer.showCount", { count: rows.length }) : undefined}
          >
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status: status as InvoiceState[] })} placeholder={t("invoices.explorer.statusPlaceholder")} aria-label={t("invoices.explorer.filterByStatus")} className="w-40" />
            <Combobox
              options={contactOptions}
              value={state.contact || ALL_CONTACTS}
              onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })}
              placeholder={t("invoices.explorer.allContacts")}
              aria-label={t("invoices.explorer.filterByContact")}
              className="w-56"
            />
            {filtersOn && !isPhone && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("invoices.explorer.clearFilters")}
              </Button>
            )}
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="invoices-updated">
                {refreshing ? t("invoices.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <PhoneMoreActions>
            {isPhone ? (
              <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !invoices} onClick={() => void load("refresh")}>
                <RefreshCw size={16} aria-hidden />
                {t("invoices.explorer.refreshList")}
              </Button>
            ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("invoices.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !invoices} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("invoices.explorer.refreshList")}</TooltipContent>
            </Tooltip>
            )}
            {/* US-INV-20 — hidden without invoices.manage_recurring, which every /recurring-invoices route also checks. */}
            {canManageRecurring && (
              <Button asChild variant="secondary">
                <Link href="/invoices/recurring">
                  <Repeat size={14} aria-hidden />
                  {t("invoices.explorer.recurringInvoices")}
                </Link>
              </Button>
            )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button asChild>
                  <Link href="/invoices/new">
                    <Plus size={14} aria-hidden />
                    {t("invoices.explorer.newInvoice")}
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
              {t("invoices.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("invoices.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {selectedInvoices.length > 0 && (
        <InvoicesBulkBar
          selected={selectedInvoices}
          onClear={() => setSelectedIds(new Set())}
          onFinished={(title, description) => {
            setActionError(null);
            setSelectedIds(new Set());
            void load("refresh");
            showToast(title, description);
          }}
          onFailed={(title, message) => setActionError({ title, message })}
        />
      )}

      {!rows ? (
        <InvoicesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Receipt />}
                title={t("invoices.explorer.noMatchTitle")}
                description={t("invoices.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("invoices.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Receipt />}
                title={t("invoices.explorer.emptyTitle")}
                description={t("invoices.explorer.emptyDescription")}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/invoices/new">{t("invoices.explorer.newInvoice")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <InvoicesTable
          invoices={rows}
          now={today}
          sort={state.sort}
          onSortChange={(sort) => update({ sort })}
          page={state.page}
          onPageChange={(page) => update({ page })}
          toolbarStart={isPhone ? <span /> : search}
          onDeleted={(invoice) => {
            void load("refresh");
            showToast(t("invoices.explorer.deletedTitle"), t("invoices.explorer.deletedDescription", { number: invoice.number ?? t("invoices.explorer.draftInvoice") }));
          }}
          onActionFailed={(invoice, message) => setActionError({ title: t("invoices.explorer.actionFailedTitle", { number: invoice.number ?? t("invoices.explorer.theDraftInvoice") }), message })}
          selected={selectedIds}
          onToggleSelected={toggleSelected}
          phoneSelecting={selecting}
        />
      )}
    </div>
  );
}
