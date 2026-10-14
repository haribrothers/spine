"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
  EmptyState,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import type { CustomerRefund } from "@spine/shared";
import { Banknote, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { paymentRecordedToast, RecordPaymentDialog } from "../../../components/record-payment-dialog";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { useToast } from "../../../components/toast-host";
import { PaymentsSkeleton } from "./payments-skeleton";
import { PaymentsTable } from "./payments-table";
import {
  PAYMENT_RANGES,
  PAYMENT_RANGE_LABELS,
  filterPayments,
  hasPaymentFilters,
  parsePaymentsState,
  paymentContacts,
  paymentRefundsThisMonth,
  paymentStats,
  paymentsQuery,
  type MoneySum,
  type PaymentRange,
  type PaymentsListState,
} from "./payments-list-state";
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentMethod } from "./types";

const ALL_CONTACTS = "__all__";
const METHOD_OPTIONS = (Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }));

/**
 * The Payments list's client-side body (US-PAY-21, US-PAY-22, D-221): cards
 * for Received this month, Credit to use (a filter) and Refunded this
 * month; every payment loaded once and filtered here; search, contact,
 * method, date range, card, sort and page in the address (D-210), with
 * Refresh and a quiet refresh after 30 s away. "Record payment" opens the
 * shared dialog; the new payment's page opens once it's recorded. An old
 * `?id=` link (notifications, the bank register) opens the payment's page.
 */
export function PaymentsExplorer() {
  const canCreate = useCapability("payments.edit_own");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PaymentsListState>(() => parsePaymentsState(new URLSearchParams(searchParams.toString())));
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [refunds, setRefunds] = useState<CustomerRefund[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [yearStart, setYearStart] = useState<{ month: number; day: number } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  // US-OPS-42: `?new=1` (search's "Record payment") opens the dialog.
  const newParam = searchParams.get("new") === "1";
  useEffect(() => {
    if (newParam && canCreate) setRecordOpen(true);
  }, [newParam, canCreate]);
  const loading = useRef(false);
  const showToast = useToast();

  // US-PAY-19: `/payments?id=` (old links) opens the payment's own page.
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) router.replace(`/payments/${id}`);
    // Once, on arrival.
  }, []);

  function update(patch: Partial<PaymentsListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, paymentsQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setPayments(await apiClient.get<Payment[]>("/payments"));
      apiClient
        .get<CustomerRefund[]>("/customer-refunds")
        .then(setRefunds)
        .catch(() => setRefunds([]));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement("Payments updated");
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Could not load payments.");
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("id")) return;
    void load("first");
    apiClient
      .get<{ value: { code?: string } | null }>("/org/settings/currency")
      .then((res) => setCurrency(res.value?.code ?? null))
      .catch(() => {});
    apiClient
      .get<{ value: { month: number; day: number } | null }>("/org/settings/financial_year_start")
      .then((res) => res.value && setYearStart(res.value))
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

  const today = useMemo(() => new Date(now), [now]);
  const orgCurrency = currency ?? payments?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (payments ? paymentStats(payments, orgCurrency, today) : null), [payments, orgCurrency, today]);
  const refunded = useMemo(() => (refunds ? paymentRefundsThisMonth(refunds, orgCurrency, today) : null), [refunds, orgCurrency, today]);
  const rows = useMemo(() => (payments ? filterPayments(payments, state, today, yearStart) : null), [payments, state, today, yearStart]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: "All contacts" }, ...paymentContacts(payments ?? [])], [payments]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => `${formatMoney(s.amount, orgCurrency)}${s.otherCurrencies ? " + other currencies" : ""}`;
  const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  // Shown once data has loaded (in the browser), so the server's HTML has no date to disagree with.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });
  const pressed = state.card === "credit";

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder="Search receipts, references, customers or invoices" aria-label="Search payments" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasPaymentFilters(state);
  const clearAll = () => update({ q: "", contact: "", method: [], range: "all", card: "" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="payment-stats">
        <StatCard
          label="Received this month"
          value={stats ? money(stats.received) : "—"}
          detail={stats ? countOf(stats.received.count, "payment") : undefined}
          trend={{ direction: "neutral", label: stats ? `Received since ${monthStart}` : "Received this month" }}
          className="h-full"
        />
        <button
          type="button"
          aria-pressed={pressed}
          aria-label={`Show payments with credit left, ${stats ? stats.credit.count : 0} customers`}
          onClick={() => update({ card: pressed ? "" : "credit" })}
          className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label="Credit to use"
            value={stats ? money(stats.credit) : "—"}
            detail={stats ? countOf(stats.credit.count, "customer") : undefined}
            tone={stats && stats.credit.amount > 0n ? "warning" : "default"}
            trend={{ direction: "neutral", label: pressed ? "Showing these · press again to clear" : "Show these payments" }}
            className={cn("h-full transition-colors hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
          />
        </button>
        <StatCard
          label="Refunded this month"
          value={refunded ? money(refunded) : "—"}
          detail={refunded ? countOf(refunded.count, "refund") : undefined}
          trend={{ direction: "neutral", label: refunded ? `Paid back since ${monthStart}` : "Paid back this month" }}
          className="h-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Combobox options={contactOptions} value={state.contact || ALL_CONTACTS} onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })} placeholder="All contacts" aria-label="Filter by contact" className="w-56" />
            <MultiSelect options={METHOD_OPTIONS} value={state.method} onValueChange={(v) => update({ method: v as PaymentMethod[] })} placeholder="Method" aria-label="Filter by method" className="w-40" />
            <Select value={state.range} onValueChange={(v) => update({ range: v as PaymentRange })}>
              <SelectTrigger aria-label="Show payments from" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {PAYMENT_RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="payments-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !payments} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            {canCreate && (
              <Button onClick={() => setRecordOpen(true)}>
                <Plus size={14} aria-hidden />
                Record payment
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

      {!rows ? (
        <PaymentsSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Banknote />}
                title="No payments match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Banknote />}
                title="No payments recorded yet"
                description="Record a payment against one or more invoices, or hold it as unallocated customer credit."
                action={canCreate ? <Button onClick={() => setRecordOpen(true)}>Record payment</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <PaymentsTable payments={rows} now={today} sort={state.sort} onSortChange={(sort) => update({ sort })} page={state.page} onPageChange={(page) => update({ page })} toolbarStart={search} />
      )}

      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} onRecorded={(p) => {
          showToast(...paymentRecordedToast(p));
          router.push(`/payments/${p.id}`);
        }} />
    </div>
  );
}
