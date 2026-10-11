"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, Combobox, EmptyState, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn } from "@spine/ui";
import { Plus, Receipt, RefreshCw, Repeat, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { useEntityToast } from "./entity-toast";
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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const loading = useRef(false);
  const { show: showToast, toast } = useEntityToast();

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
      if (mode === "refresh") setAnnouncement("Invoices updated");
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Could not load invoices.");
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

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
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: "All contacts" }, ...invoiceContacts(invoices ?? [])], [invoices]);
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

  const money = (s: MoneySum) => `${formatMoney(s.amount, orgCurrency)}${s.otherCurrencies ? " + other currencies" : ""}`;
  const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const card = (label: string, sum: MoneySum | null, key: InvoiceCard | null, hint: string, ariaHint: string, tone: "default" | "warning" | "critical" = "default", noun = "invoice") => {
    const pressed = key ? state.card === key : false;
    const inner = (
      <StatCard
        label={label}
        value={sum ? money(sum) : "—"}
        detail={sum ? countOf(sum.count, noun) : undefined}
        tone={sum && sum.count > 0 ? tone : "default"}
        trend={{ direction: "neutral", label: pressed ? "Showing these · press again to clear" : hint }}
        className={cn("h-full transition-colors", key && "hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!key) return inner;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${ariaHint}, ${sum ? sum.count : 0}`}
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
      <Input type="search" placeholder="Search invoices, lines or jobs" aria-label="Search invoices" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  const filtersOn = hasInvoiceFilters(state);
  const clearAll = () => update({ q: "", status: [], contact: "", card: "" });
  // The first of this month in the business's locale ("1 Oct", "Oct 1"). Shown once payments load, in the
  // browser, so the server's HTML (no payments yet) never carries a date that could differ from the client's.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="invoice-stats">
        {card("Outstanding", stats?.outstanding ?? null, "outstanding", "Show these invoices", "Show outstanding invoices")}
        {card("Overdue", stats?.overdue ?? null, "overdue", "Show these invoices", "Show overdue invoices", "critical")}
        {card("Due in 7 days", stats?.due7 ?? null, "due7", "Show these invoices", "Show invoices due in 7 days", "warning")}
        {card("Paid this month", paid, null, paid ? `Received since ${monthStart}` : "Received this month", "", "default", "payment")}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status: status as InvoiceState[] })} placeholder="Status" aria-label="Filter by status" className="w-40" />
            <Combobox
              options={contactOptions}
              value={state.contact || ALL_CONTACTS}
              onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })}
              placeholder="All contacts"
              aria-label="Filter by contact"
              className="w-56"
            />
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="invoices-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !invoices} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            {/* US-INV-20 — hidden without invoices.manage_recurring, which every /recurring-invoices route also checks. */}
            {canManageRecurring && (
              <Button asChild variant="secondary">
                <Link href="/invoices/recurring">
                  <Repeat size={14} aria-hidden />
                  Recurring invoices
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus size={14} aria-hidden />
                  New invoice
                </Link>
              </Button>
            )}
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              Couldn&apos;t refresh the list. Check your connection and try again.
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {selectedInvoices.length > 0 && (
        <InvoicesBulkBar
          selected={selectedInvoices}
          onClear={() => setSelectedIds(new Set())}
          onFinished={(title, description) => {
            setSelectedIds(new Set());
            void load("refresh");
            showToast(title, description);
          }}
        />
      )}

      {!rows ? (
        <InvoicesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Receipt />}
                title="No invoices match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Receipt />}
                title="No invoices yet"
                description="Build a multi-line invoice for a customer — save it as a draft, then issue when it's ready."
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/invoices/new">New invoice</Link>
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
          toolbarStart={search}
          onDeleted={(invoice) => {
            void load("refresh");
            showToast("Invoice deleted", `${invoice.number ?? "Draft invoice"} has been permanently removed.`);
          }}
          onActionFailed={(_invoice, message) => showToast("Couldn't do that", message)}
          selected={selectedIds}
          onToggleSelected={toggleSelected}
        />
      )}
      {toast}
    </div>
  );
}
