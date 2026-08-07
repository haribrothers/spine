"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../lib/api-client";
import { QuotesSkeleton } from "./quotes-skeleton";
import { QuotesTable } from "./quotes-table";
import type { Quote } from "./types";
import { useQuoteStats } from "./use-quote-stats";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

/**
 * The Quotes list page's client-side body (PRD F3 Stage 1) — a stat-card
 * row, a status filter, and one table, following CatalogExplorer's exact
 * structure (proportionate scope, no view switcher). "Expired" in the
 * status filter isn't a stored status — QuotesService computes it at read
 * time (S-03.11) and this filter matches on the returned `isExpired` flag.
 */
export function QuotesExplorer() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const stats = useQuoteStats(quotes);

  const loadQuotes = useCallback(() => {
    apiClient
      .get<Quote[]>("/quotes")
      .then(setQuotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quotes."));
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return null;
    if (!statusFilter.length) return quotes;
    return quotes.filter((q) => statusFilter.includes(q.status) || (statusFilter.includes("expired") && q.isExpired));
  }, [quotes, statusFilter]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total quotes" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Draft" value={stats.draft === null ? "—" : String(stats.draft)} />
        <StatCard label="Sent" value={stats.sent === null ? "—" : String(stats.sent)} />
        <StatCard label="Accepted" value={stats.accepted === null ? "—" : String(stats.accepted)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MultiSelect
          options={STATUS_OPTIONS}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          className="w-40"
        />
        <Button asChild>
          <Link href="/quotes/new">New quote</Link>
        </Button>
      </div>

      {!filteredQuotes ? (
        <QuotesSkeleton />
      ) : filteredQuotes.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length ? (
            <EmptyState
              icon={<FileText />}
              title="No quotes match these filters"
              description="Try adjusting or clearing the status filter above."
              action={
                <Button variant="secondary" onClick={() => setStatusFilter([])}>
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
                <Button asChild>
                  <Link href="/quotes/new">New quote</Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <QuotesTable quotes={filteredQuotes} />
      )}
    </div>
  );
}
