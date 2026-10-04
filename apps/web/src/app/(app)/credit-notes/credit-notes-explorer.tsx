"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { Undo2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { CreditNoteDetailDrawer } from "../invoices/credit-note-detail-drawer";
import { CreditNotesSkeleton } from "./credit-notes-skeleton";
import { CreditNotesTable } from "./credit-notes-table";
import { useCreditNoteStats } from "./use-credit-note-stats";
import type { ContactOption, CreditNoteRow } from "./types";
import { formatMoney } from "../../../lib/money";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
];

const ALL_CONTACTS = "__all__";

/**
 * The org-wide `/credit-notes` list page's client body — previously credit
 * notes had no standalone list, only rows inside an invoice's own
 * `credit-notes-section.tsx` (`?invoiceId=` filtered). Mirrors
 * `payments/payments-explorer.tsx`'s structure (stat cards, a contact
 * filter, one table, click-to-drawer) plus a status filter like
 * `invoices/invoices-explorer.tsx` has, since `GET /credit-notes` already
 * returns drafts too (a draft is a real, if usually short-lived, state —
 * `create-credit-note-dialog.tsx` creates and issues in one atomic action,
 * so a lingering draft here would mean an abandoned/failed flow worth
 * being able to find).
 *
 * Deliberately has NO "New credit note" entry point (confirmed with the
 * user) — `POST /credit-notes` requires an already-issued, non-advance
 * invoiceId (see `CreditNotesService.create`'s own validation), so there's
 * no meaningful blank-slate creation flow to build here; creation stays
 * exactly where it already has full context: an invoice's own "Issue
 * credit note" button. This page is list-and-drill-down only.
 */
export function CreditNotesExplorer() {
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [openCreditNoteId, setOpenCreditNoteId] = useState<string | null>(null);

  const stats = useCreditNoteStats(creditNotes);

  const loadCreditNotes = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<CreditNoteRow[]>(`/credit-notes${query}`)
      .then(setCreditNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load credit notes."));
  }, [contactFilter]);

  useEffect(() => {
    loadCreditNotes();
  }, [loadCreditNotes]);

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

  const filteredCreditNotes = useMemo(() => {
    if (!creditNotes) return null;
    if (!statusFilter.length) return creditNotes;
    return creditNotes.filter((cn) => statusFilter.includes(cn.status));
  }, [creditNotes, statusFilter]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total credit notes" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard
          label="Total credited (issued)"
          value={
            stats.issuedTotal === null
              ? stats.hasMixedCurrencies
                ? "Mixed currencies"
                : "—"
              : `${formatMoney(stats.issuedTotal, stats.currency ?? "USD")} ${stats.currency ?? ""}`
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          options={STATUS_OPTIONS}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Status"
          aria-label="Filter by status"
          className="w-40"
        />
        <Combobox options={contactOptions} value={contactFilter} onValueChange={setContactFilter} placeholder="All contacts" className="w-48" />
      </div>

      {!filteredCreditNotes ? (
        <CreditNotesSkeleton />
      ) : filteredCreditNotes.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Undo2 />}
            title={statusFilter.length || contactFilter !== ALL_CONTACTS ? "No credit notes match these filters" : "No credit notes yet"}
            description={
              statusFilter.length || contactFilter !== ALL_CONTACTS
                ? "Try adjusting or clearing the filters above."
                : "Issue one from an invoice's own detail page when you need to correct or refund part of it."
            }
          />
        </div>
      ) : (
        <CreditNotesTable creditNotes={filteredCreditNotes} onOpen={(cn) => setOpenCreditNoteId(cn.id)} />
      )}

      <CreditNoteDetailDrawer
        creditNoteId={openCreditNoteId}
        onOpenChange={(open) => {
          if (!open) setOpenCreditNoteId(null);
        }}
      />
    </div>
  );
}
