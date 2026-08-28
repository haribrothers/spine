"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { EmailQueueButton } from "./email-queue-dialog";
import { useEntityToast } from "./entity-toast";
import { QuotesSkeleton } from "./quotes-skeleton";
import { QuotesTable } from "./quotes-table";
import type { ContactOption, Quote } from "./types";
import { useQuoteStats } from "./use-quote-stats";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const ALL_CONTACTS = "__all__";

/**
 * The Quotes list page's client-side body (PRD F3 Stage 1) — a stat-card
 * row, a status filter, and one table, following CatalogExplorer's exact
 * structure (proportionate scope, no view switcher). "Expired" in the
 * status filter isn't a stored status — QuotesService computes it at read
 * time (S-03.11) and this filter matches on the returned `isExpired` flag.
 */
export function QuotesExplorer() {
  const canCreate = useCapability("quotes.edit_own");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const { show: showToast, toast } = useEntityToast();

  const stats = useQuoteStats(quotes);

  const loadQuotes = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<Quote[]>(`/quotes${query}`)
      .then(setQuotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quotes."));
  }, [contactFilter]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  // Item 5, user feedback — filter by contact. Fetched once (not scoped to
  // "only contacts with a quote") since the point of the filter is to find
  // a contact's quotes, and the Combobox's own search-as-you-type already
  // makes a full contact list easy to navigate, matching contact-picker.tsx's
  // own precedent for the quote builder's contact field.
  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const contactOptions = useMemo(
    () => [
      { value: ALL_CONTACTS, label: "All contacts" },
      ...contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    ],
    [contacts],
  );

  const filteredQuotes = useMemo(() => {
    if (!quotes) return null;
    if (!statusFilter.length) return quotes;
    return quotes.filter((q) => statusFilter.includes(q.status) || (statusFilter.includes("expired") && q.isExpired));
  }, [quotes, statusFilter]);

  function handleDeleted(quote: Quote) {
    loadQuotes();
    showToast("Quote deleted", `${quote.number ?? "Draft quote"} has been permanently removed.`);
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            className="w-40"
          />
          <Combobox
            options={contactOptions}
            value={contactFilter}
            onValueChange={setContactFilter}
            placeholder="All contacts"
            className="w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <EmailQueueButton />
          {canCreate && (
            <Button asChild>
              <Link href="/quotes/new">New quote</Link>
            </Button>
          )}
        </div>
      </div>

      {!filteredQuotes ? (
        <QuotesSkeleton />
      ) : filteredQuotes.length === 0 ? (
        <div className="rounded-lg border border-border">
          {statusFilter.length || contactFilter !== ALL_CONTACTS ? (
            <EmptyState
              icon={<FileText />}
              title="No quotes match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter([]);
                    setContactFilter(ALL_CONTACTS);
                  }}
                >
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
      ) : (
        <QuotesTable quotes={filteredQuotes} onDeleted={handleDeleted} />
      )}
      {toast}
    </div>
  );
}
