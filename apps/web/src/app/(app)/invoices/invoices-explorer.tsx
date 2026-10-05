"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../../../lib/api-client";
import { useCapability } from "../../../lib/capabilities-context";
import { useEntityToast } from "./entity-toast";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { InvoicesTable } from "./invoices-table";
import { InvoicesBulkBar } from "./invoices-bulk-bar";
import type { ContactOption, Invoice } from "./types";
import { useInvoiceStats } from "./use-invoice-stats";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "void", label: "Void" },
  { value: "overdue", label: "Overdue" },
];

const ALL_CONTACTS = "__all__";

/**
 * The Invoices list page's client-side body — a stat-card row, a status
 * filter, a contact filter, and one table, mirroring
 * quotes/quotes-explorer.tsx's exact structure. "Overdue" in the status
 * filter isn't a stored status (there's no "expired" concept for invoices,
 * unlike quotes' S-03.11) — InvoicesService computes `isOverdue` at read
 * time (S-05.9) and this filter matches on that flag, same pattern as
 * quotes' own "expired" filter.
 */
export function InvoicesExplorer() {
  const canCreate = useCapability("invoices.edit_own");
  const canManageRecurring = useCapability("invoices.manage_recurring");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // US-DASH-13: "Send reminder" for several overdue invoices opens ?status=overdue&select=overdue — filtered, with them ticked.
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string[]>(() => searchParams.get("status")?.split(",").filter(Boolean) ?? []);
  const selectOverdue = searchParams.get("select") === "overdue";
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { show: showToast, toast } = useEntityToast();

  const stats = useInvoiceStats(invoices);

  const loadInvoices = useCallback(() => {
    const query = contactFilter !== ALL_CONTACTS ? `?contactId=${contactFilter}` : "";
    apiClient
      .get<Invoice[]>(`/invoices${query}`)
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load invoices."));
  }, [contactFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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

  const filteredInvoices = useMemo(() => {
    if (!invoices) return null;
    if (!statusFilter.length) return invoices;
    return invoices.filter((inv) => statusFilter.includes(inv.status) || (statusFilter.includes("overdue") && inv.isOverdue));
  }, [invoices, statusFilter]);

  const [preselected, setPreselected] = useState(false);
  useEffect(() => {
    if (!selectOverdue || preselected || !invoices) return;
    setSelectedIds(new Set(invoices.filter((i) => i.isOverdue).map((i) => i.id)));
    setPreselected(true);
  }, [selectOverdue, preselected, invoices]);

  // US-INV-23 — ticked rows still on the list (a deleted invoice drops out).
  const selectedInvoices = useMemo(() => (invoices ?? []).filter((i) => selectedIds.has(i.id)), [invoices, selectedIds]);

  function toggleSelected(invoice: Invoice, on: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (on) next.add(invoice.id);
      else next.delete(invoice.id);
      return next;
    });
  }

  function handleDeleted(invoice: Invoice) {
    loadInvoices();
    showToast("Invoice deleted", `${invoice.number ?? "Draft invoice"} has been permanently removed.`);
  }

  function handleReminderSent(invoice: Invoice) {
    showToast("Reminder queued", `A reminder for ${invoice.number ?? "this invoice"} has been queued.`);
  }

  function handleReminderFailed(invoice: Invoice, message: string) {
    showToast("Could not send reminder", message);
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
        <StatCard label="Total invoices" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Draft" value={stats.draft === null ? "—" : String(stats.draft)} />
        <StatCard label="Issued" value={stats.issued === null ? "—" : String(stats.issued)} />
        <StatCard label="Overdue" value={stats.overdue === null ? "—" : String(stats.overdue)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            aria-label="Filter by status"
            className="w-40"
          />
          <Combobox
            options={contactOptions}
            value={contactFilter}
            onValueChange={setContactFilter}
            placeholder="All contacts"
            aria-label="Filter by contact"
            className="w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* US-INV-20 — hidden without invoices.manage_recurring, which every /recurring-invoices route also checks. */}
          {canManageRecurring && (
            <Button asChild variant="secondary">
              <Link href="/invoices/recurring">Recurring invoices</Link>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/invoices/new">New invoice</Link>
            </Button>
          )}
        </div>
      </div>

      {selectedInvoices.length > 0 && (
        <InvoicesBulkBar
          selected={selectedInvoices}
          onClear={() => setSelectedIds(new Set())}
          onFinished={(title, description) => {
            setSelectedIds(new Set());
            loadInvoices();
            showToast(title, description);
          }}
        />
      )}

      {!filteredInvoices ? (
        <InvoicesSkeleton />
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          {statusFilter.length || contactFilter !== ALL_CONTACTS ? (
            <EmptyState
              icon={<Receipt />}
              title="No invoices match these filters"
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
              icon={<Receipt />}
              title="No invoices yet"
              description="Build a multi-line invoice for a customer — save it as a draft, then issue when it's ready."
              action={
                canCreate ? (
                  <Button asChild>
                    <Link href="/invoices/new">New invoice</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <InvoicesTable
          invoices={filteredInvoices}
          onDeleted={handleDeleted}
          onReminderSent={handleReminderSent}
          onReminderFailed={handleReminderFailed}
          selected={selectedIds}
          onToggleSelected={toggleSelected}
        />
      )}
      {toast}
    </div>
  );
}
