"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  ChipStrip,
  Combobox,
  EmptyState,
  FilterSheet,
  FloatingActionButton,
  Input,
  MultiSelect,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type FilterChip,
} from "@spine/ui";
import { FileText, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { useToast } from "../../../components/toast-host";
import { QuotesSkeleton } from "./quotes-skeleton";
import { QuotesTable } from "./quotes-table";
import {
  filterQuotes,
  hasQuoteFilters,
  parseQuotesState,
  quoteContacts,
  quoteStats,
  quotesQuery,
  winRateText,
  type MoneySum,
  type QuoteCard,
  type QuotesListState,
} from "./quotes-list-state";
import type { Quote } from "./types";
import { QUOTE_TOASTS } from "./quote-row-actions";
import { ActionError } from "../../../components/action-error";
import { t as translate, useT } from "../../../lib/i18n";
import { PhoneMoreActions } from "../../../lib/phone-bar";
import { useIsPhone } from "../../../lib/use-is-phone";

const STATUS_OPTIONS = [
  { value: "draft", label: translate("quotes.status.draft") },
  { value: "sent", label: translate("quotes.status.sent") },
  { value: "accepted", label: translate("quotes.status.accepted") },
  { value: "rejected", label: translate("quotes.status.declined") },
  { value: "expired", label: translate("quotes.status.expired") },
];

const ALL_CONTACTS = "__all__";

/**
 * The Quotes list page's client-side body.
 *
 * US-QUO-27 to US-QUO-29 (D-214): every quote is loaded once and filtered
 * here. The cards count each quote once (its newest version) — Open,
 * Expiring in 7 days, Won this month and Win rate — and the first three
 * filter. Search, status, contact, card, sort and page live in the address
 * (D-210), with Refresh and a quiet refresh on coming back after 30 s.
 * "Expired" isn't a stored status — the API computes `isExpired`.
 */
export function QuotesExplorer() {
  const t = useT();
  const canCreate = useCapability("quotes.edit_own");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<QuotesListState>(() => parseQuotesState(new URLSearchParams(searchParams.toString())));
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const isPhone = useIsPhone();
  const loading = useRef(false);
  const showToast = useToast();

  /** Sets part of the list state and writes it to the address. */
  function update(patch: Partial<QuotesListState>) {
    const next = { ...state, page: 1, ...patch };
    setState(next);
    replaceQuery(pathname, quotesQuery(next));
  }

  const load = useCallback(async (mode: "first" | "refresh") => {
    if (loading.current) return;
    loading.current = true;
    if (mode === "refresh") setRefreshing(true);
    try {
      setQuotes(await apiClient.get<Quote[]>("/quotes"));
      setRefreshFailed(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      if (mode === "refresh") setAnnouncement(t("quotes.explorer.updated"));
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : t("quotes.explorer.loadFailed"));
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

  const today = useMemo(() => new Date(now), [now]);
  const orgCurrency = currency ?? quotes?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (quotes ? quoteStats(quotes, orgCurrency, today) : null), [quotes, orgCurrency, today]);
  const rows = useMemo(() => (quotes ? filterQuotes(quotes, state, today) : null), [quotes, state, today]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: t("quotes.explorer.allContacts") }, ...quoteContacts(quotes ?? [])], [quotes, t]);

  function handleDeleted(quote: Quote) {
    void load("refresh");
    showToast(...QUOTE_TOASTS.deleted(quote));
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.amount > 0n || s.otherCurrencies ? (s.otherCurrencies ? t("quotes.explorer.moneyWithOther", { amount: formatMoney(s.amount, orgCurrency) }) : formatMoney(s.amount, orgCurrency)) : "");

  const card = (label: string, value: string, extra: string, key: QuoteCard | null, hint: string, ariaHint: string, tone?: "warn") => {
    const pressed = key ? state.card === key : false;
    const inner = (
      <StatCard
        label={label}
        value={value}
        detail={extra || undefined}
        tone={tone === "warn" && Number(value) > 0 ? "warning" : "default"}
        trend={{ direction: "neutral", label: pressed ? t("quotes.explorer.showingThese") : hint }}
        className={cn("h-full transition-colors", key && "hover:border-border-strong", pressed && "border-primary bg-info-bg/60 ring-1 ring-primary")}
      />
    );
    if (!key) return inner;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${ariaHint}, ${value}`}
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
      <Input type="search" placeholder={t("quotes.explorer.searchPlaceholder")} aria-label={t("quotes.explorer.searchLabel")} value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  const filtersOn = hasQuoteFilters(state);
  // US-OPS-57: a chip for each filter that's on, with × to remove it (on a phone).
  const cardNames: Record<string, string> = { open: t("quotes.explorer.open"), expiring: t("quotes.explorer.expiring"), won: t("quotes.explorer.won") };
  const filterChips: FilterChip[] = [
    ...state.status.map((status) => ({ key: `status-${status}`, label: STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status, onRemove: () => update({ status: state.status.filter((s) => s !== status) }) })),
    ...(state.contact ? [{ key: "contact", label: contactOptions.find((o) => o.value === state.contact)?.label ?? state.contact, onRemove: () => update({ contact: "" }) }] : []),
    ...(state.card ? [{ key: "card", label: cardNames[state.card] ?? state.card, onRemove: () => update({ card: "" }) }] : []),
  ];
  const clearAll = () => update({ q: "", status: [], contact: "", card: "" });

  return (
    <div className="flex flex-col gap-6">
      {/* US-OPS-57: on a phone the cards are chips in one row that scrolls sideways. */}
      <ChipStrip className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="quote-stats">
        {/* eslint-disable-next-line i18next/no-literal-string -- card keys */}
        {card(t("quotes.explorer.open"), stats ? String(stats.open.count) : "—", stats ? money(stats.open) : "", "open", t("quotes.explorer.openHint"), t("quotes.explorer.openAria"))}
        {/* eslint-disable-next-line i18next/no-literal-string -- card keys and tone */}
        {card(t("quotes.explorer.expiring"), stats ? String(stats.expiring) : "—", "", "expiring", t("quotes.explorer.showThese"), t("quotes.explorer.expiringAria"), "warn")}
        {/* eslint-disable-next-line i18next/no-literal-string -- card keys */}
        {card(t("quotes.explorer.won"), stats ? String(stats.won.count) : "—", stats ? money(stats.won) : "", "won", t("quotes.explorer.showThese"), t("quotes.explorer.wonAria"))}
        {card(
          t("quotes.explorer.winRate"),
          stats ? winRateText(stats.winRate) : "—",
          "",
          null,
          stats && stats.winRate.closed ? t("quotes.explorer.winRateHint", { won: stats.winRate.won, closed: stats.winRate.closed }) : t("quotes.explorer.winRateNone"),
          "",
        )}
      </ChipStrip>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* US-OPS-57: on a phone, search and Filters in one row, the filters in a sheet. */}
          <FilterSheet
            className="flex flex-wrap items-center gap-2"
            search={isPhone ? search : undefined}
            chips={filterChips}
            onClearAll={clearAll}
            showLabel={rows ? t("quotes.explorer.showCount", { count: rows.length }) : undefined}
          >
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status })} placeholder={t("quotes.explorer.statusPlaceholder")} aria-label={t("quotes.explorer.statusFilter")} className="w-40" />
            <Combobox
              options={contactOptions}
              value={state.contact || ALL_CONTACTS}
              onValueChange={(v) => update({ contact: v === ALL_CONTACTS ? "" : v })}
              placeholder={t("quotes.explorer.allContacts")}
              aria-label={t("quotes.explorer.contactFilter")}
              className="w-56"
            />
            {filtersOn && !isPhone && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                {t("quotes.explorer.clearFilters")}
              </Button>
            )}
          </FilterSheet>
          <div className="flex flex-wrap items-center gap-2">
            {updatedAt !== null && (
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="quotes-updated">
                {refreshing ? t("quotes.explorer.updating") : updatedLabel(updatedAt, now)}
              </span>
            )}
            <PhoneMoreActions>
              {isPhone ? (
                <Button variant="secondary" aria-busy={refreshing} disabled={refreshing || !quotes} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden />
                  {t("quotes.explorer.refresh")}
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" aria-label={t("quotes.explorer.refresh")} aria-busy={refreshing} disabled={refreshing || !quotes} onClick={() => void load("refresh")}>
                      <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("quotes.explorer.refresh")}</TooltipContent>
                </Tooltip>
              )}
            </PhoneMoreActions>
            {canCreate && (
              <FloatingActionButton>
                <Button asChild>
                  <Link href="/quotes/new">
                    <Plus size={14} aria-hidden />
                    {t("quotes.explorer.newQuote")}
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
              {t("quotes.explorer.refreshFailed")}
              <Button variant="secondary" size="sm" onClick={() => void load("refresh")}>
                {t("quotes.explorer.tryAgain")}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {actionError && <ActionError {...actionError} onDismiss={() => setActionError(null)} />}
      </div>

      {!rows ? (
        <QuotesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          {!isPhone && <div className="flex">{search}</div>}
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<FileText />}
                title={t("quotes.explorer.noMatchTitle")}
                description={t("quotes.explorer.noMatchDescription")}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {t("quotes.explorer.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<FileText />}
                title={t("quotes.explorer.emptyTitle")}
                description={t("quotes.explorer.emptyDescription")}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/quotes/new">{t("quotes.explorer.newQuote")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      ) : (
        <QuotesTable
          quotes={rows}
          now={today}
          sort={state.sort}
          onSortChange={(sort) => update({ sort })}
          page={state.page}
          onPageChange={(page) => update({ page })}
          toolbarStart={isPhone ? <span /> : search}
          onDeleted={handleDeleted}
          onNotify={(title, description) => {
            setActionError(null);
            showToast(title, description);
          }}
          onActionFailed={(title, message) => setActionError({ title, message })}
        />
      )}
    </div>
  );
}
