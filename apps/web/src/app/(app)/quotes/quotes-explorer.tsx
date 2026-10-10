"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Button,
  Combobox,
  EmptyState,
  Input,
  MultiSelect,
  StatCard,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@spine/ui";
import { FileText, Plus, RefreshCw, Search } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { replaceQuery } from "../../../lib/replace-query";
import { REFRESH_ON_RETURN_MS, updatedLabel } from "../contacts/contacts-list-state";
import { EmailQueueButton } from "./email-queue-dialog";
import { useEntityToast } from "./entity-toast";
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Declined" },
  { value: "expired", label: "Expired" },
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
  const canCreate = useCapability("quotes.edit_own");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<QuotesListState>(() => parseQuotesState(new URLSearchParams(searchParams.toString())));
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const loading = useRef(false);
  const { show: showToast, toast } = useEntityToast();

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
      if (mode === "refresh") setAnnouncement("Quotes updated");
    } catch (err) {
      if (mode === "first") setError(err instanceof Error ? err.message : "Could not load quotes.");
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
  const orgCurrency = currency ?? quotes?.[0]?.currency ?? "USD";
  const stats = useMemo(() => (quotes ? quoteStats(quotes, orgCurrency, today) : null), [quotes, orgCurrency, today]);
  const rows = useMemo(() => (quotes ? filterQuotes(quotes, state, today) : null), [quotes, state, today]);
  const contactOptions = useMemo(() => [{ value: ALL_CONTACTS, label: "All contacts" }, ...quoteContacts(quotes ?? [])], [quotes]);

  function handleDeleted(quote: Quote) {
    void load("refresh");
    showToast("Quote deleted", `${quote.number ?? "Draft quote"} has been permanently removed.`);
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const money = (s: MoneySum) => (s.amount > 0n || s.otherCurrencies ? `${formatMoney(s.amount, orgCurrency)}${s.otherCurrencies ? " + other currencies" : ""}` : "");

  const card = (label: string, value: string, extra: string, key: QuoteCard | null, hint: string, ariaHint: string, tone?: "warn") => {
    const pressed = key ? state.card === key : false;
    const inner = (
      <StatCard
        label={label}
        value={value}
        detail={extra || undefined}
        tone={tone === "warn" && Number(value) > 0 ? "warning" : "default"}
        trend={{ direction: "neutral", label: pressed ? "Showing these · press again to clear" : hint }}
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
      <Input type="search" placeholder="Search quotes, titles or lines" aria-label="Search quotes" value={state.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
    </div>
  );

  const filtersOn = hasQuoteFilters(state);
  const clearAll = () => update({ q: "", status: [], contact: "", card: "" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="quote-stats">
        {card("Open", stats ? String(stats.open.count) : "—", stats ? money(stats.open) : "", "open", "Sent and still valid", "Show open quotes")}
        {card("Expiring in 7 days", stats ? String(stats.expiring) : "—", "", "expiring", "Show these quotes", "Show quotes expiring in 7 days", "warn")}
        {card("Won this month", stats ? String(stats.won.count) : "—", stats ? money(stats.won) : "", "won", "Show these quotes", "Show quotes won this month")}
        {card(
          "Win rate",
          stats ? winRateText(stats.winRate) : "—",
          "",
          null,
          stats && stats.winRate.closed ? `${stats.winRate.won} of ${stats.winRate.closed} in the last 90 days` : "None closed in the last 90 days",
          "",
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelect options={STATUS_OPTIONS} value={state.status} onValueChange={(status) => update({ status })} placeholder="Status" aria-label="Filter by status" className="w-40" />
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
              <span className="whitespace-nowrap text-[12px] text-on-surface-muted" data-testid="quotes-updated">
                {refreshing ? "Updating…" : updatedLabel(updatedAt, now)}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Refresh list" aria-busy={refreshing} disabled={refreshing || !quotes} onClick={() => void load("refresh")}>
                  <RefreshCw size={16} aria-hidden className={cn(refreshing && "text-primary motion-safe:animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>
            <EmailQueueButton />
            {canCreate && (
              <Button asChild>
                <Link href="/quotes/new">
                  <Plus size={14} aria-hidden />
                  New quote
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

      {!rows ? (
        <QuotesSkeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex">{search}</div>
          <div className="rounded-lg border border-border bg-surface">
            {filtersOn ? (
              <EmptyState
                icon={<FileText />}
                title="No quotes match these filters"
                description="Try adjusting or clearing the filters above."
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<FileText />}
                title="No quotes yet"
                description="Build a multi-line quote for a customer — save it as a draft, then send when it's ready."
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link href="/quotes/new">New quote</Link>
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
          toolbarStart={search}
          onDeleted={handleDeleted}
          onNotify={showToast}
        />
      )}
      {toast}
    </div>
  );
}
