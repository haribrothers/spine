"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, Combobox, EmptyState, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn, type TableSort } from "@spine/ui";
import type { VendorPaymentsSummary } from "@spine/shared";
import { HandCoins, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { filenameFrom, saveBlob } from "../../../lib/save-file";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
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
      if (mode === "first") setError(err instanceof Error ? err.message : "Couldn't load vendor payments.");
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
  const vendors = useMemo(() => [{ value: ALL, label: "All vendors" }, ...(payments ? paymentVendors(payments) : [])], [payments]);
  const filtersOn = hasVendorPaymentFilters(state);
  const clearAll = () => update({ q: "", vendor: "", method: [], range: "all" });
  const money = (v: string) => formatMoney(BigInt(v), summary?.currency ?? "USD");
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  async function download(p: VendorPaymentRow) {
    setActionError(null);
    try {
      const { blob, headers } = await apiClient.download(`/vendor-payments/${p.id}/remittance.pdf`);
      saveBlob(blob, filenameFrom(headers, `remittance-${p.number ?? "payment"}.pdf`));
    } catch (err) {
      setActionError({ title: "Couldn't download the remittance advice.", message: err instanceof Error ? err.message : "Try again." });
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
      <Input value={state.q} onChange={(e) => update({ q: e.target.value })} placeholder="Search numbers, references, vendors or bills" aria-label="Search vendor payments" className="pl-9" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="vendor-payment-stats">
        <StatCard label="Paid this month" value={summary ? money(summary.paidThisMonth) : "—"} trend={{ direction: "neutral", label: summary ? count(summary.paidThisMonthCount, "payment") : "" }} className="h-full" />
        <StatCard label="Paid last month" value={summary ? money(summary.paidLastMonth) : "—"} trend={{ direction: "neutral", label: summary ? count(summary.paidLastMonthCount, "payment") : "" }} className="h-full" />
        <button
          type="button"
          className="h-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => router.push("/vendor-bills?card=overdue")}
          aria-label="To pay — open overdue vendor bills"
        >
          <StatCard
            label="To pay"
            value={summary ? money(summary.toPay) : "—"}
            trend={{ direction: "neutral", label: summary ? `${count(summary.toPayCount, "overdue bill")} · open Vendor bills` : "" }}
            tone={summary && BigInt(summary.toPay) > 0n ? "critical" : "default"}
            className="h-full"
          />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Combobox options={vendors} value={state.vendor || ALL} onValueChange={(v) => update({ vendor: v === ALL ? "" : v })} placeholder="All vendors" aria-label="Filter by vendor" className="w-56" />
            <MultiSelect options={METHOD_OPTIONS} value={state.method} onValueChange={(v) => update({ method: v as PaymentMethod[] })} placeholder="Method" aria-label="Filter by method" className="w-40" />
            <Combobox options={RANGE_OPTIONS} value={state.range} onValueChange={(v) => update({ range: v as PaymentRange })} aria-label="Filter by date" className="w-44" />
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && <span className="whitespace-nowrap text-[12px] text-on-surface-muted">{refreshing ? "Updating…" : updatedLabel(updatedAt, now)}</span>}
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
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <VendorPaymentsSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<HandCoins />}
                title="No vendor payments match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<HandCoins />}
                title="No vendor payments recorded yet"
                description="Record a payment against one or more of a vendor's recorded bills."
                action={canCreate ? <Button onClick={() => setRecordOpen(true)}>Record payment</Button> : undefined}
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
          toolbarStart={search}
          onDownload={(p) => void download(p)}
        />
      )}

      <RecordVendorPaymentDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        initialContactId={payFor}
        onRecorded={(p) => {
          showToast(`${p.number ?? "Payment"} recorded`, "It's posted to your books, and the bills it paid owe less.");
          router.push(`/vendor-payments/${p.id}`);
        }}
      />
    </div>
  );
}
