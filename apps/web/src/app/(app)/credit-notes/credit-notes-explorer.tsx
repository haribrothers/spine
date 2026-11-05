"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, Button, Combobox, EmptyState, Input, MultiSelect, StatCard, Tooltip, TooltipContent, TooltipTrigger, cn } from "@spine/ui";
import type { CustomerRefund } from "@spine/shared";
import { Plus, RefreshCw, Search, Undo2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { CreateCreditNoteDialog, creditNoteIssuedToast } from "../invoices/create-credit-note-dialog";
import { useToast } from "../../../components/toast-host";
import type { Invoice } from "../invoices/types";
import { CreditNotesSkeleton } from "./credit-notes-skeleton";
import { CreditNotesTable } from "./credit-notes-table";
import { NewCreditNoteDialog } from "./new-credit-note-dialog";
import {
  WHERE_LABELS,
  creditNoteContacts,
  creditNoteStats,
  creditNotesQuery,
  filterCreditNotes,
  hasCreditNoteFilters,
  parseCreditNotesState,
  refundedThisMonth,
  type CreditNotesListState,
  type MoneySum,
  type WhereItWent,
} from "./credit-notes-list-state";
import type { CreditNoteRow } from "./types";
import { useT } from "../../../lib/i18n";

const WHERE_OPTIONS = (Object.keys(WHERE_LABELS) as WhereItWent[]).map((value) => ({ value, label: WHERE_LABELS[value] }));
const ALL_CONTACTS = "__all__";

/**
 * The Credit Notes list's client-side body (US-INV-37, US-INV-40, US-INV-41,
 * D-219): cards for Credited this month, Credit to use (a filter) and
 * Refunded this month; every credit note loaded once and filtered here;
 * search, "Where it went", contact, card, sort and page in the address
 * (D-210), with Refresh and a quiet refresh after 30 s away. "New credit
 * note" picks an issued invoice, then opens the issue dialog; the new
 * credit note's page opens once it's issued.
 */
export function CreditNotesExplorer() {
  const t = useT();
  const canIssue = useCapability("credit_notes.issue");
  const router = useRouter();
  const showToast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CreditNotesListState>(() => parseCreditNotesState(new URLSearchParams(searchParams.toString())));
  const [notes, setNotes] = useState<CreditNoteRow[] | null>(null);
  const [refunds, setRefunds] = useState<CustomerRefund[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [crediting, setCrediting] = useState<Invoice | null>(null);
  const loading = useRef(false);

  function update(patch: Partial<CreditNotesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, creditNotesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setNotes(await apiClient.get<CreditNoteRow[]>("/credit-notes"));
      apiClient
        .get<CustomerRefund[]>("/customer-refunds")
        .then(setRefunds)
        .catch(() => setRefunds([]));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(t("creditNotes.explorer.updatedAnnouncement"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("creditNotes.explorer.loadFailed"));
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

  const today = useMemo(() => new Date(now), [now]);
  const orgCurrency = currency ?? notes?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (notes ? creditNoteStats(notes, orgCurrency, today) : null), [notes, orgCurrency, today]);
  const refunded = useMemo(() => (refunds ? refundedThisMonth(refunds, orgCurrency, today) : null), [refunds, orgCurrency, today]);
  const rows = useMemo(() => (notes ? filterCreditNotes(notes, state) : null), [notes, state]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: t("creditNotes.explorer.allContacts") }, ...creditNoteContacts(notes ?? [])], [notes, t]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.otherCurrencies ? t("creditNotes.explorer.otherCurrencies", { amount: formatMoney(s.amount, orgCurrency) }) : formatMoney(s.amount, orgCurrency));
  // Shown once data has loaded (in the browser), so the server's HTML has no date to disagree with.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString(orgLocaleTag(), { day: "numeric", month: "short" });
  const pressed = state.card === "left";

  const search = (
    <div className="relative w-80">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted" aria-hidden />
      <Input type="search" placeholder={t("creditNotes.explorer.searchPlaceholder")} aria-label={t("creditNotes.explorer.searchAria")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );
  const filtersOn = hasCreditNoteFilters(state);
  const clearAll = () => update({ q: "", where: [], contact: "", card: "" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="credit-note-stats">
        <StatCard
          label={t("creditNotes.explorer.creditedThisMonth")}
          value={stats ? money(stats.credited) : "—"}
          detail={stats ? t("creditNotes.explorer.creditNoteCount", { count: stats.credited.count }) : undefined}
          trend={{ direction: "neutral", label: stats ? t("creditNotes.explorer.issuedSince", { date: monthStart }) : t("creditNotes.explorer.issuedThisMonth") }}
          className="h-full"
        />
        <button
          type="button"
          aria-pressed={pressed}
          aria-label={t("creditNotes.explorer.showLeftAria", { n: stats ? stats.toUse.count : 0 })}
          onClick={() => update({ card: pressed ? "" : "left" })}
          className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <StatCard
            label={t("creditNotes.explorer.creditToUse")}
            value={stats ? money(stats.toUse) : "—"}
            detail={stats ? t("creditNotes.explorer.customerCount", { count: stats.toUse.count }) : undefined}
            tone={stats && stats.toUse.amount > 0n ? "warning" : "default"}
            trend={{ direction: "neutral", label: pressed ? t("creditNotes.explorer.showingThese") : t("creditNotes.explorer.showThese") }}
            className={cn("h-full transition-colors hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
          />
        </button>
        <StatCard
          label={t("creditNotes.explorer.refundedThisMonth")}
          value={refunded ? money(refunded) : "—"}
          detail={refunded ? t("creditNotes.explorer.refundCount", { count: refunded.count }) : undefined}
          trend={{ direction: "neutral", label: refunded ? t("creditNotes.explorer.paidBackSince", { date: monthStart }) : t("creditNotes.explorer.paidBackThisMonth") }}
          className="h-full"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={WHERE_OPTIONS} value={state.where} onValueChange={(where) => update({ where: where as WhereItWent[] })} placeholder={t("creditNotes.explorer.wherePlaceholder")} aria-label={t("creditNotes.explorer.filterByWhere")} className="w-44" />
            <Combobox
              options={contactOptions}
              value={state.contact || ALL_CONTACTS}
              onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })}
              placeholder={t("creditNotes.explorer.allContacts")}
              aria-label={t("creditNotes.explorer.filterByContact")}
              className="w-56"
            />
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("creditNotes.explorer.clearFilters")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="credit-notes-updated">
                {refreshing ? t("creditNotes.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={t("creditNotes.explorer.refreshList")} aria-busy={refreshing} disabled={refreshing || !notes} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("creditNotes.explorer.refreshList")}</TooltipContent>
            </Tooltip>
            {canIssue && (
              <Button onClick={() => setPickOpen(true)}>
                <Plus size={14} aria-hidden />
                {t("creditNotes.explorer.newCreditNote")}
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
              {t("creditNotes.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("creditNotes.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {!rows ? (
        <CreditNotesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<Undo2 />}
                title={t("creditNotes.explorer.noMatchTitle")}
                description={t("creditNotes.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("creditNotes.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Undo2 />}
                title={t("creditNotes.explorer.emptyTitle")}
                description={t("creditNotes.explorer.emptyDescription")}
                action={canIssue ? <Button onClick={() => setPickOpen(true)}>{t("creditNotes.explorer.newCreditNote")}</Button> : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <CreditNotesTable creditNotes={rows} now={today} sort={state.sort} onSortChange={(sort) => update({ sort })} page={state.page} onPageChange={(page) => update({ page })} toolbarStart={search} />
      )}

      <NewCreditNoteDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        onPicked={(invoice) => {
          setPickOpen(false);
          setCrediting(invoice);
        }}
      />
      {crediting && (
        <CreateCreditNoteDialog
          open
          onOpenChange={(open) => !open && setCrediting(null)}
          invoiceId={crediting.id}
          invoiceNumber={crediting.number}
          customerName={crediting.contactName}
          onIssued={(note) => {
            showToast(...creditNoteIssuedToast(note, crediting.contactName));
            router.push(`/credit-notes/${note.id}`);
          }}
        />
      )}
    </div>
  );
}
