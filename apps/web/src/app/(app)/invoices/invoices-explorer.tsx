"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Combobox, EmptyState, MultiSelect, StatCard } from "@spine/ui";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useEntityToast } from "./entity-toast";
import { InvoicesSkeleton } from "./invoices-skeleton";
import { InvoicesTable } from "./invoices-table";
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
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState<string>(ALL_CONTACTS);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
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

  function handleDeleted(invoice: Invoice) {
    loadInvoices();
    showToast("Invoice deleted", `${invoice.number ?? "Draft invoice"} has been permanently removed.`);
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
        <Button asChild>
          <Link href="/invoices/new">New invoice</Link>
        </Button>
      </div>

      {!filteredInvoices ? (
        <InvoicesSkeleton />
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-lg border border-border">
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
                <Button asChild>
                  <Link href="/invoices/new">New invoice</Link>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <InvoicesTable invoices={filteredInvoices} onDeleted={handleDeleted} />
      )}
      {toast}
    </div>
  );
}
