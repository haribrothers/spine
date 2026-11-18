"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AppShellHeader,
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { PAYABLES_AGES, PAYABLES_AGE_LABELS, type PayablesAge } from "@spine/shared";
import { HandCoins, Info, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { ReportExportMenu } from "../../../components/report-export-menu";
import { PrintHeader } from "../../../components/print-header";
import { AgingSummary } from "../../../components/aging-summary";
import { ActionError } from "../../../components/action-error";
import { useToast } from "../../../components/toast-host";
import { useT } from "../../../lib/i18n";
import { RecordVendorPaymentDialog } from "../vendor-payments/record-vendor-payment-dialog";
import { ApplyCreditToBillDialog } from "../vendor-bills/apply-credit-to-bill-dialog";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { PayablesSkeleton } from "./payables-skeleton";
import { PayablesVendorsTable } from "./payables-vendors-table";
import { PayablesBillsTable } from "./payables-bills-table";
import { PayablesBulkBar } from "./payables-bulk-bar";
import { draftsNote, emptyAge, filterBills, parsePayablesState, payablesQuery, vendorView, type PayablesListState, type PayablesTab } from "./payables-list-state";
import type { PayablesBillRow, PayablesReport } from "./types";

import { SectionLink } from "../../../components/section-link";
import { useSelectMode } from "../../../lib/phone-bar";
const ALL_AGES = "__all__";

type Dialog = { kind: "pay"; contactId: string; billIds: string[] } | { kind: "credit"; row: PayablesBillRow } | null;

/**
 * Payables (US-PUR-13, US-PUR-56 to US-PUR-60, D-230): what we owe vendors
 * and for how long, to pay from. The list layout every refined list
 * shares — tabs (By vendor, By bill), the cards and age bar (pressable, to
 * filter by age, with "Due in 7 days"), the filter bar (age; Updated,
 * Refresh, Export) and the search bar — with tab, age, search, sort and
 * page in the address (D-210). Rows pay and apply credit through the
 * existing dialogs; bills ticked from one vendor are paid together. The
 * aging adds up recorded bills' balances; drafts are a note.
 */
export function PayablesExplorer() {
  const t = useT();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canPay = useCapability("vendor_payments.edit_own");
  // US-OPS-56: on a phone the top bar's Select shows the ticks; Done clears them.
  const selecting = useSelectMode({ available: Boolean(canPay), onDone: () => setSelected(new Set()) });
  const [state, setState] = useState<PayablesListState>(() => parsePayablesState(new URLSearchParams(searchParams.toString())));
  const [report, setReport] = useState<PayablesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const loading = useRef(false);
  const showToast = useToast();

  function update(patch: Partial<PayablesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    setSelected(new Set());
    replaceQuery(pathname, payablesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      const next = await apiClient.get<PayablesReport>("/reports/payables");
      setReport(next);
      // A paid bill drops out of the selection.
      setSelected((current) => new Set([...current].filter((id) => next.bills.some((b) => b.id === id))));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(t("payables.explorer.updated"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("payables.explorer.loadFailed"));
      else setRefreshFailed(true);
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("first");
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
  const bills = useMemo(() => (report ? filterBills(report.bills, state) : null), [report, state]);
  const vendors = useMemo(() => (report ? vendorView(report.vendors, report.bills, state) : null), [report, state]);
  const creditByContact = useMemo(() => new Map((report?.vendors ?? []).map((v) => [v.contactId, BigInt(v.credit)])), [report]);
  const selectedRows = useMemo(() => (report ? report.bills.filter((b) => selected.has(b.id)) : []), [report, selected]);

  /** After an action: what happened (D-223), and the list again. */
  function done(title: string, description: string) {
    setDialog(null);
    setActionError(null);
    setSelected(new Set());
    showToast(title, description);
    void load("refresh");
  }

  const locale = orgLocaleTag();
  const asOf = report ? new Date(`${report.asOf}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : null;
  const header = (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("payables.explorer.breadcrumbPurchases") }, { label: t("payables.explorer.title") }]}
        title={t("payables.explorer.title")}
        description={asOf ? t("payables.explorer.descriptionAsOf", { date: asOf }) : t("payables.explorer.description")}
      />
      <PrintHeader />
    </>
  );

  if (error) {
    return (
      <>
        {header}
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </>
    );
  }

  const currency = report?.bills[0]?.currency ?? "USD";
  const overdueCount = report ? report.bills.filter((r) => r.bucket !== "current").length : 0;
  const ageQuery = state.age ? `?age=${encodeURIComponent(state.age)}` : "";
  const search = (
    <div className="relative w-96 max-w-full">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input
        type="search"
        placeholder={state.tab === "vendor" ? t("payables.explorer.searchVendors") : t("payables.explorer.searchBills")}
        aria-label={t("payables.explorer.searchLabel")}
        value={state.q}
        onChange={(e) => update({ q: e.target.value })}
        className="pl-9"
      />
    </div>
  );
  const drafts = report ? draftsNote(report.drafts, formatMoney(BigInt(report.drafts.amount), currency)) : null;
  const empty = (message: string, clear: () => void, label: string) => (
    <div className="flex flex-col gap-3">
      <div className="flex">{search}</div>
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState icon={<HandCoins />} title={message} description={t("payables.explorer.emptyAgeDescription")} action={<Button variant="secondary" onClick={clear}>{label}</Button>} />
      </div>
    </div>
  );
  const pay = (contactId: string, billIds: string[]) => setDialog({ kind: "pay", contactId, billIds });

  const body = !report ? (
    <PayablesSkeleton />
  ) : (
    <div className="flex flex-col gap-6">
      <AgingSummary
        buckets={report.buckets}
        total={report.totalOutstanding}
        overdueCount={overdueCount}
        noun="bill"
        currency={currency}
        totalLabel={t("payables.explorer.totalOwed")}
        chartTitle={t("payables.explorer.chartTitle")}
        totalDetail={t("payables.explorer.totalDetail", { bills: t("payables.explorer.billCount", { count: report.bills.length }), vendors: t("payables.explorer.vendorCount", { count: report.vendors.length }) })}
        dueSoon={report.dueSoon}
        age={state.age}
        onAgeChange={(age) => update({ age })}
        note={
          drafts && (
            <span className="flex flex-wrap items-center gap-2" data-testid="drafts-note">
              <Info size={15} aria-hidden />
              {drafts}
              <SectionLink href="/vendor-bills?card=drafts" className="font-medium text-primary hover:underline">
                {t("payables.explorer.seeDrafts")}
              </SectionLink>
            </span>
          )
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3" data-print="hide">
          <Select value={state.age ?? ALL_AGES} onValueChange={(v) => update({ age: v === ALL_AGES ? null : (v as PayablesAge) })}>
            <SelectTrigger aria-label={t("payables.explorer.showByAge")} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AGES}>{t("payables.explorer.allAges")}</SelectItem>
              {PAYABLES_AGES.map((a) => (
                <SelectItem key={a} value={a}>
                  {PAYABLES_AGE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="payables-updated">
                {refreshing ? t("payables.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("payables.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("payables.explorer.refreshList")}</TooltipContent>
            </Tooltip>
            <ReportExportMenu path={`/reports/payables${ageQuery}`} csvPath={`/reports/payables/export.csv${ageQuery}`} search={state.q} />
          </div>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
        {refreshFailed && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t("payables.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("payables.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {report.bills.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState icon={<HandCoins />} title={t("payables.explorer.nothingOutstandingTitle")} description={t("payables.explorer.nothingOutstandingDescription")} />
        </div>
      ) : state.tab === "vendor" ? (
        vendors!.length === 0 ? (
          state.q.trim() ? empty(t("payables.explorer.noVendorsMatch"), () => update({ q: "" }), t("payables.explorer.clearSearch")) : empty(emptyAge(state.age!), () => update({ age: null }), t("payables.explorer.showAll"))
        ) : (
          <PayablesVendorsTable
            vendors={vendors!}
            currency={currency}
            now={today}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={search}
            actions={{
              onPay: (v) => pay(v.contactId, []),
              // The vendor's credit goes against their oldest bill first; the dialog says which.
              onApplyCredit: (v) => v.bills[0] && setDialog({ kind: "credit", row: v.bills[0] }),
            }}
          />
        )
      ) : bills!.length === 0 ? (
        state.q.trim() ? empty(t("payables.explorer.noBillsMatch"), () => update({ q: "" }), t("payables.explorer.clearSearch")) : empty(emptyAge(state.age!), () => update({ age: null }), t("payables.explorer.showAll"))
      ) : (
        <div className="flex flex-col gap-3">
          {canPay && selectedRows.length > 0 && <PayablesBulkBar selected={selectedRows} onPay={() => pay(selectedRows[0]!.contactId, selectedRows.map((b) => b.id))} onClear={() => setSelected(new Set())} />}
          <PayablesBillsTable
            bills={bills!}
            now={today}
            sort={state.sort}
            onSortChange={(sort) => update({ sort })}
            page={state.page}
            onPageChange={(page) => update({ page })}
            toolbarStart={search}
            selected={canPay ? selected : undefined}
            onSelectedChange={canPay ? setSelected : undefined}
            phoneSelecting={selecting}
            actions={{
              onPay: (row) => pay(row.contactId, [row.id]),
              onApplyCredit: (row) => setDialog({ kind: "credit", row }),
              hasCredit: (contactId) => (creditByContact.get(contactId) ?? 0n) > 0n,
            }}
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {header}
      <Tabs value={state.tab} onValueChange={(tab) => update({ tab: tab as PayablesTab, sort: null })}>
        <TabsList className="mb-4" data-print="hide">
          <TabsTrigger value="vendor" className="group" aria-label={report ? t("payables.explorer.byVendorCount", { count: report.vendors.length }) : t("payables.explorer.byVendor")}>
            {t("payables.explorer.byVendor")}
            {report && <Count n={report.vendors.length} />}
          </TabsTrigger>
          <TabsTrigger value="bill" className="group" aria-label={report ? t("payables.explorer.byBillCount", { count: report.bills.length }) : t("payables.explorer.byBill")}>
            {t("payables.explorer.byBill")}
            {report && <Count n={report.bills.length} />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={state.tab} className="pt-0">
          {body}
        </TabsContent>
      </Tabs>

      <RecordVendorPaymentDialog
        open={dialog?.kind === "pay"}
        onOpenChange={(open) => !open && setDialog(null)}
        initialContactId={dialog?.kind === "pay" ? dialog.contactId : undefined}
        initialBillIds={dialog?.kind === "pay" ? dialog.billIds : undefined}
        onRecorded={(payment) => done(payment.number ? t("payables.explorer.paymentNumberRecorded", { number: payment.number }) : t("payables.explorer.paymentRecorded"), t("payables.explorer.paymentRecordedDescription"))}
      />
      {dialog?.kind === "credit" && (
        <ApplyCreditToBillDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          bill={dialog.row}
          onApplied={(total) => done(t("payables.explorer.creditApplied"), t("payables.explorer.creditAppliedDescription", { amount: formatMoney(total, dialog.row.currency), number: dialog.row.billNumber }))}
        />
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-full border border-border bg-surface-sunken px-1.5 text-[11px] font-semibold tabular-nums text-on-surface-muted group-data-[state=active]:border-transparent group-data-[state=active]:bg-info-bg group-data-[state=active]:text-primary">
      {n}
    </span>
  );
}
