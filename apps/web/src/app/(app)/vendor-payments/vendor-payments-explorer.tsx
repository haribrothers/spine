"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, ChipStrip, Combobox, EmptyState, FilterSheet, FloatingActionButton, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn, type FilterChip, type TableSort } from "@spine/ui";
import type { VendorPaymentsSummary } from "@spine/shared";
import { HandCoins, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { useT } from "../../../lib/i18n";
import { PhoneMoreActions } from "../../../lib/phone-bar";
import { useIsPhone } from "../../../lib/use-is-phone";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { PAYMENT_RANGES, type PaymentRange } from "../payments/payments-list-state";
import { RecordVendorPaymentDialog } from "./record-vendor-payment-dialog";
import { VendorPaymentsSkeleton } from "./vendor-payments-skeleton";
import { VendorPaymentsTable } from "./vendor-payments-table";
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type VendorPaymentRow } from "./types";
import {
  VENDOR_PAYMENT_RANGE_LABELS,
  filterVendorPayments,
  hasVendorPaymentFilters,
  parseVendorPaymentsState,
  paymentVendors,
  vendorPaymentsQuery,
  type VendorPaymentsListState,
} from "./vendor-payments-state";

const ALL = "__all__";
const METHOD_OPTIONS = (Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => ({ value, label }));
const RANGE_OPTIONS = PAYMENT_RANGES.map((r) => ({ value: r, label: VENDOR_PAYMENT_RANGE_LABELS[r] }));

/**
 * The Vendor payments list (US-PUR-51, D-229): cards in money — Paid this
 * month, Paid last month, and To pay (overdue bills, opening Vendor bills
 * filtered to overdue) — then the layout every refined list shares (D-210):
 * vendor, method and date range on the left of the filter bar with
 * Updated, Refresh and Record payment on the right; search and Columns
 * below; newest first; everything kept in the address. A payment opens on
 * its own page (US-PUR-49); old `?id=` links go there. The dashboard's
 * `?contactId=<vendor>&pay=1` opens the record dialog on that vendor.
 */
export function VendorPaymentsExplorer() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useToast();
  const canCreate = useCapability("vendor_payments.edit_own");
  const [state, setState] = useState<VendorPaymentsListState>(() => parseVendorPaymentsState(new URLSearchParams(searchParams.toString())));
  const [payments, setPayments] = useState<VendorPaymentRow[] | null>(null);
  const [summary, setSummary] = useState<VendorPaymentsSummary | null>(null);
  const [yearStart, setYearStart] = useState<{ month: number; day: number } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const payFor = searchParams.get("pay") === "1" ? (searchParams.get("contactId") ?? undefined) : undefined;
  const [recordOpen, setRecordOpen] = useState(Boolean(payFor));
  // US-OPS-42: `?new=1` (search's "Record vendor payment") opens the dialog.
  const newParam = searchParams.get("new") === "1";
  useEffect(() => {
    if (newParam && canCreate) setRecordOpen(true);
  }, [newParam, canCreate]);
  const isPhone = useIsPhone();
  const loading = useRef(false);

  // US-PUR-49: an old `?id=` link opens the payment's page.
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) router.replace(`/vendor-payments/${id}`);
  }, [searchParams, router]);

  function update(patch: Partial<VendorPaymentsListState>) {
    const next = { ...state, ...patch, page: "page" in patch ? (patch.page ?? 1) : 1 };
    setState(next);
    replaceQuery(pathname, vendorPaymentsQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const [rows, cards] = await Promise.all([apiClient.get<VendorPaymentRow[]>("/vendor-payments"), apiClient.get<VendorPaymentsSummary>("/vendor-payments/summary").catch(() => null)]);
      setPayments(rows);
      setSummary(cards);
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("vendorPayments.explorer.loadFailed"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
    apiClient
      .get<{ value: { month: number; day: number } | null }>("/org/settings/financial_year_start")
      .then((res) => res.value && setYearStart(res.value))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt >= REFRESH_ON_RETURN_MS) void load("refresh");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = useMemo(() => new Date(now), [now]);
  const rows = useMemo(() => (payments ? filterVendorPayments(payments, state, today, yearStart) : null), [payments, state, today, yearStart]);
  const vendors = useMemo(() => [{ value: ALL, label: t("vendorPayments.explorer.allVendors") }, ...(payments ? paymentVendors(payments) : [])], [payments]);
  const filtersOn = hasVendorPaymentFilters(state);
  const clearAll = () => update({ q: "", vendor: "", method: [], range: "all" });
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const filterChips: FilterChip[] = [
    ...(state.vendor ? [{ key: "vendor", label: vendors.find((o) => o.value === state.vendor)?.label ?? state.vendor, onRemove: () => update({ vendor: "" }) }] : []),
    ...state.method.map((method) => ({ key: `method-${method}`, label: PAYMENT_METHOD_LABELS[method] ?? method, onRemove: () => update({ method: state.method.filter((m) => m !== method) }) })),
    ...(state.range !== "all" ? [{ key: "range", label: VENDOR_PAYMENT_RANGE_LABELS[state.range], onRemove: () => update({ range: "all" }) }] : []),
  ];
  const money = (v: string) => formatMoney(BigInt(v), summary?.currency ?? "USD");

  async function download(p: VendorPaymentRow) {
    setActionError(null);
    try {
      const { blob, headers } = await apiClient.download(`/vendor-payments/${p.id}/remittance.pdf`);
      saveBlob(blob, filenameFrom(headers, `remittance-${p.number ?? "payment"}.pdf`));
    } catch (err) {
      setActionError({ title: t("vendorPayments.explorer.downloadFailed"), message: err instanceof Error ? err.message : t("vendorPayments.explorer.tryAgain") });
    }
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const search = (
    <div className="relative w-full max-w-md">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" />
      <Input value={state.q} onChange={(e) => update({ q: e.target.value })} placeholder={t("vendorPayments.explorer.searchPlaceholder")} aria-label={t("vendorPayments.explorer.searchLabel")} className="pl-9" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="vendor-payment-stats">
        <StatCard label={t("vendorPayments.explorer.paidThisMonth")} value={summary ? money(summary.paidThisMonth) : "—"} trend={{ direction: "neutral", label: summary ? t("vendorPayments.explorer.payments", { count: summary.paidThisMonthCount }) : "" }} className="h-full" />
        <StatCard label={t("vendorPayments.explorer.paidLastMonth")} value={summary ? money(summary.paidLastMonth) : "—"} trend={{ direction: "neutral", label: summary ? t("vendorPayments.explorer.payments", { count: summary.paidLastMonthCount }) : "" }} className="h-full" />
        <button
          type="button"
          className="h-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => router.push("/vendor-bills?card=overdue")}
          aria-label={t("vendorPayments.explorer.toPayLabel")}
        >
          <StatCard
            label={t("vendorPayments.explorer.toPay")}
            value={summary ? money(summary.toPay) : "—"}
            trend={{ direction: "neutral", label: summary ? t("vendorPayments.explorer.toPayTrend", { bills: t("vendorPayments.explorer.overdueBills", { count: summary.toPayCount }) }) : "" }}
            tone={summary && BigInt(summary.toPay) > 0n ? "critical" : "default"}
            className="h-full"
          />
        </button>
      </ChipStrip>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* US-OPS-57: on a phone, search and Filters in one row, the filters in a sheet. */}
          <FilterSheet
            className="flex flex-wrap items-center gap-2"
            search={isPhone ? search : undefined}
            chips={filterChips}
            onClearAll={clearAll}
            showLabel={rows ? t("vendorPayments.explorer.showCount", { count: rows.length }) : undefined}
          >
            <Combobox options={vendors} value={state.vendor || ALL} onValueChange={(v) => update({ vendor: v === ALL ? "" : v })} placeholder={t("vendorPayments.explorer.allVendors")} aria-label={t("vendorPayments.explorer.filterByVendor")} className="w-56" />
            <MultiSelect options={METHOD_OPTIONS} value={state.method} onValueChange={(v) => update({ method: v as PaymentMethod[] })} placeholder={t("vendorPayments.explorer.methodPlaceholder")} aria-label={t("vendorPayments.explorer.filterByMethod")} className="w-40" />
            <Combobox options={RANGE_OPTIONS} value={state.range} onValueChange={(v) => update({ range: v as PaymentRange })} aria-label={t("vendorPayments.explorer.filterByDate")} className="w-44" />
            {filtersOn && !isPhone && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("vendorPayments.explorer.clearFilters")}
              </Button>
            )}
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && <span className="whitespace-nowrap text-[12px] text-on-surface-muted">{refreshing ? t("vendorPayments.explorer.updating") : updatedLabel(updatedAt, now)}</span>}
            <PhoneMoreActions>
              {isPhone ? (
                <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !payments} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden />
                  {t("vendorPayments.explorer.refreshList")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label={t("vendorPayments.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !payments} onClick={() => void load("refresh")}>
                      <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("vendorPayments.explorer.refreshList")}</TooltipContent>
                </Tooltip>
              )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button onClick={() => setRecordOpen(true)}>
                  <Plus size={14} aria-hidden />
                  {t("vendorPayments.explorer.recordPayment")}
                </Button>
              </FloatingActionButton>
            )}
          </div>
        </div>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("vendorPayments.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("vendorPayments.explorer.tryAgainButton")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <VendorPaymentsSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<HandCoins />}
                title={t("vendorPayments.explorer.noMatchTitle")}
                description={t("vendorPayments.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("vendorPayments.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<HandCoins />}
                title={t("vendorPayments.explorer.emptyTitle")}
                description={t("vendorPayments.explorer.emptyDescription")}
                action={canCreate ? <Button onClick={() => setRecordOpen(true)}>{t("vendorPayments.explorer.recordPayment")}</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <VendorPaymentsTable
          payments={rows}
          now={today}
          sort={state.sort}
          onSortChange={(sort: TableSort | null) => update({ sort })}
          page={state.page}
          onPageChange={(page) => update({ page })}
          toolbarStart={isPhone ? <span /> : search}
          onDownload={(p) => void download(p)}
        />
      )}

      <RecordVendorPaymentDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        initialContactId={payFor}
        onRecorded={(p) => {
          showToast(t("vendorPayments.explorer.recordedToast", { number: p.number ?? t("vendorPayments.explorer.payment") }), t("vendorPayments.explorer.recordedToastDescription"));
          router.push(`/vendor-payments/${p.id}`);
        }}
      />
    </div>
  );
}
