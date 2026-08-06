"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, MultiSelect, StatCard } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import { ContactCreateDrawer } from "./contact-create-drawer";
import { ContactsCardView } from "./contacts-card-view";
import { ContactsListView } from "./contacts-list-view";
import { ContactsSkeleton } from "./contacts-skeleton";
import { ContactsTable } from "./contacts-table";
import { ContactsViewSwitcher, VIEW_STORAGE_KEY, type ContactView } from "./contacts-view-switcher";
import type { Contact, ContactType, Lead } from "./types";
import { useContactStats } from "./use-contact-stats";

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "both", label: "Customer & vendor" },
];

const ARCHIVED_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

/**
 * The Contacts list page's client-side body — stat cards, view switcher,
 * multiselect filters, the three views, and the create Drawer, all owned
 * here so a create/archive/delete anywhere can refresh the list without a
 * full page reload (same reasoning the original ContactsTable's own
 * comment gave for client-side loading).
 */
export function ContactsExplorer({ initialDrawerOpen }: { initialDrawerOpen: boolean }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ContactView>("table");
  const [hydrated, setHydrated] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "table" || stored === "list" || stored === "card") setView(stored);
    setHydrated(true);
  }, []);

  function handleViewChange(next: ContactView) {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const loadContacts = useCallback(() => {
    const params = new URLSearchParams();
    for (const t of typeFilter) params.append("type", t);
    if (statusFilter.includes("archived")) params.set("includeArchived", "true");
    const query = params.toString();
    apiClient
      .get<Contact[]>(`/contacts${query ? `?${query}` : ""}`)
      .then((rows) => {
        // The API's includeArchived flag is all-or-nothing (returns both
        // active and archived together); when only "Archived" is checked
        // (not "Active"), filter client-side rather than adding a
        // dedicated API mode for a two-checkbox combination.
        const onlyArchived = statusFilter.includes("archived") && !statusFilter.includes("active");
        setContacts(onlyArchived ? rows.filter((c) => c.archivedAt) : rows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load contacts."));
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    apiClient
      .get<Lead[]>("/leads")
      .then(setLeads)
      .catch(() => setLeads([]));
  }, []);

  const activeLeadCount = useMemo(
    () => (leads ? leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length : null),
    [leads],
  );
  const stats = useContactStats(contacts, activeLeadCount);

  function handleCreated() {
    loadContacts();
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
        <StatCard label="Total contacts" value={stats.total === null ? "—" : String(stats.total)} />
        <StatCard label="Customers" value={stats.customers === null ? "—" : String(stats.customers)} />
        <StatCard label="Vendors" value={stats.vendors === null ? "—" : String(stats.vendors)} />
        <StatCard label="Active leads" value={stats.activeLeads === null ? "—" : String(stats.activeLeads)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect
            options={TYPE_OPTIONS}
            value={typeFilter}
            onValueChange={setTypeFilter}
            placeholder="All types"
            className="w-44"
          />
          <MultiSelect
            options={ARCHIVED_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Status"
            className="w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <ContactsViewSwitcher value={hydrated ? view : "table"} onChange={handleViewChange} />
          <Button onClick={() => setDrawerOpen(true)}>Add contact</Button>
        </div>
      </div>

      {!contacts ? (
        <ContactsSkeleton view={hydrated ? view : "table"} />
      ) : view === "list" ? (
        <ContactsListView contacts={contacts} onChanged={loadContacts} />
      ) : view === "card" ? (
        <ContactsCardView contacts={contacts} onChanged={loadContacts} />
      ) : (
        <ContactsTable contacts={contacts} onChanged={loadContacts} />
      )}

      <ContactCreateDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onCreated={handleCreated} />
    </div>
  );
}
