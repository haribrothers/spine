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
import { useT } from "../../../lib/i18n";

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
  const t = useT();
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
      if (mode === "refresh") setAnnouncement(t("payments.explorer.updatedAnnouncement"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("payments.explorer.loadFailed"));
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
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: t("payments.explorer.allContacts") }, ...paymentContacts(payments ?? [])], [payments, t]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.otherCurrencies ? t("payments.explorer.otherCurrencies", { amount: formatMoney(s.amount, orgCurrency) }) : formatMoney(s.amount, orgCurrency));
  // Shown once data has loaded (in the browser), so the server's HTML has no date to disagree with.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });
  const pressed = state.card === "credit";

  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("payments.explorer.searchPlaceholder")} aria-label={t("payments.explorer.searchAria")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasPaymentFilters(state);
  const clearAll = () => update({ q: "", contact: "", method: [], range: "all", card: "" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="payment-stats">
        <StatCard
          label={t("payments.explorer.receivedThisMonth")}
          value={stats ? money(stats.received) : "—"}
          detail={stats ? t("payments.explorer.paymentCount", { count: stats.received.count }) : undefined}
          trend={{ direction: "neutral", label: stats ? t("payments.explorer.receivedSince", { date: monthStart }) : t("payments.explorer.receivedThisMonth") }}
          className="h-full"
        />
        <button
          type="button"
          aria-pressed={pressed}
          aria-label={t("payments.explorer.showCreditAria", { n: stats ? stats.credit.count : 0 })}
          onClick={() => update({ card: pressed ? "" : "credit" })}
          className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label={t("payments.explorer.creditToUse")}
            value={stats ? money(stats.credit) : "—"}
            detail={stats ? t("payments.explorer.customerCount", { count: stats.credit.count }) : undefined}
            tone={stats && stats.credit.amount > 0n ? "warning" : "default"}
            trend={{ direction: "neutral", label: pressed ? t("payments.explorer.showingThese") : t("payments.explorer.showThese") }}
            className={cn("h-full transition-colors hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
          />
        </button>
        <StatCard
          label={t("payments.explorer.refundedThisMonth")}
          value={refunded ? money(refunded) : "—"}
          detail={refunded ? t("payments.explorer.refundCount", { count: refunded.count }) : undefined}
          trend={{ direction: "neutral", label: refunded ? t("payments.explorer.paidBackSince", { date: monthStart }) : t("payments.explorer.paidBackThisMonth") }}
          className="h-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Combobox options={contactOptions} value={state.contact || ALL_CONTACTS} onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })} placeholder={t("payments.explorer.allContacts")} aria-label={t("payments.explorer.filterByContact")} className="w-56" />
            <MultiSelect options={METHOD_OPTIONS} value={state.method} onValueChange={(v) => update({ method: v as PaymentMethod[] })} placeholder={t("payments.explorer.methodPlaceholder")} aria-label={t("payments.explorer.filterByMethod")} className="w-40" />
            <Select value={state.range} onValueChange={(v) => update({ range: v as PaymentRange })}>
              <SelectTrigger aria-label={t("payments.explorer.showFrom")} className="w-44">
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
                {t("payments.explorer.clearFilters")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="payments-updated">
                {refreshing ? t("payments.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("payments.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !payments} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("payments.explorer.refreshList")}</TooltipContent>
            </Tooltip>
            {canCreate && (
              <Button onClick={() => setRecordOpen(true)}>
                <Plus size={14} aria-hidden />
                {t("payments.explorer.recordPayment")}
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
              {t("payments.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("payments.explorer.tryAgain")}
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
                title={t("payments.explorer.noMatchTitle")}
                description={t("payments.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("payments.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Banknote />}
                title={t("payments.explorer.emptyTitle")}
                description={t("payments.explorer.emptyDescription")}
                action={canCreate ? <Button onClick={() => setRecordOpen(true)}>{t("payments.explorer.recordPayment")}</Button> : undefined}
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
