"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, EmptyState, MultiSelect, PaginationBar, StatCard } from "@spine/ui";
import { Upload, Users } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { usePagination } from "../../lib/use-pagination";
import { ContactCreateDrawer } from "./contact-create-drawer";
import { ContactsCardView } from "./contacts-card-view";
import { ContactsListView } from "./contacts-list-view";
import { ContactsSkeleton } from "./contacts-skeleton";
import { ContactsTable } from "./contacts-table";
import { ContactsViewSwitcher, VIEW_STORAGE_KEY, type ContactView } from "./contacts-view-switcher";
import { ImportContactsDialog } from "./import/import-contacts-dialog";
import type { Contact, ContactType, Lead } from "./types";
import { useContactStats } from "./use-contact-stats";
import { useEntityToast } from "./entity-toast";

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
  const [importOpen, setImportOpen] = useState(false);
  // Deliberately separate from `contacts` above, which is filtered by the
  // page's own type/status controls (default excludes archived) — the
  // import wizard's duplicate check needs every contact regardless of
  // those filters, or an archived contact's email/phone match would be
  // missed and the same person re-imported as a new active contact.
  const [allContactsForImport, setAllContactsForImport] = useState<Contact[]>([]);
  const { show: showToast, toast } = useEntityToast();

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

  useEffect(() => {
    // One-shot flag set by contact-detail.tsx right before it navigates
    // back here on delete — that page unmounts immediately, so it has no
    // moment of its own to show the toast (same pattern as
    // "spine:contact-created" in contact-form.tsx).
    if (typeof window === "undefined") return;
    const deletedName = window.sessionStorage.getItem("spine:contact-deleted");
    if (deletedName) {
      window.sessionStorage.removeItem("spine:contact-deleted");
      showToast("Contact deleted", `${deletedName} has been permanently removed.`);
    }
  }, []);

  const activeLeadCount = useMemo(
    () => (leads ? leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length : null),
    [leads],
  );
  const stats = useContactStats(contacts, activeLeadCount);

  // Table view paginates itself (DataTable -> Table, configurablePageSize);
  // List/Card have no built-in pagination, so this hook paginates the same
  // filtered `contacts` array for those two views only.
  const { page, pageSize, total, pageRows, setPage, setPageSize } = usePagination(contacts);

  function handleCreated(contact: Contact) {
    loadContacts();
    showToast("Contact created", `${contact.name} has been added to your contacts.`);
  }

  function handleRowChanged(action: "archived" | "restored" | "deleted", contact: Contact) {
    loadContacts();
    if (action === "archived") showToast("Contact archived", `${contact.name} has been archived.`);
    else if (action === "restored") showToast("Contact restored", `${contact.name} is active again.`);
    else showToast("Contact deleted", `${contact.name} has been permanently removed.`);
  }

  function handleImported(createdCount: number) {
    loadContacts();
    showToast("Contacts imported", `${createdCount} contact${createdCount === 1 ? "" : "s"} added from CSV.`);
  }

  function handleImportOpenChange(next: boolean) {
    setImportOpen(next);
    if (next) {
      apiClient
        .get<Contact[]>("/contacts?includeArchived=true")
        .then(setAllContactsForImport)
        .catch(() => setAllContactsForImport([]));
    }
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
          <Button variant="secondary" onClick={() => handleImportOpenChange(true)}>
            <Upload size={14} />
            Import CSV
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>Add contact</Button>
        </div>
      </div>

      {!contacts ? (
        <ContactsSkeleton view={hydrated ? view : "table"} />
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-border">
          {typeFilter.length > 0 || statusFilter.length !== 1 || !statusFilter.includes("active") ? (
            <EmptyState
              icon={<Users />}
              title="No contacts match these filters"
              description="Try adjusting or clearing the filters above."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTypeFilter([]);
                    setStatusFilter(["active"]);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Users />}
              title="No contacts yet"
              description="Add your first customer or vendor to start tracking quotes, jobs and invoices against them."
              action={<Button onClick={() => setDrawerOpen(true)}>Add contact</Button>}
            />
          )}
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-3">
          <ContactsListView contacts={pageRows ?? []} onChanged={handleRowChanged} />
          <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      ) : view === "card" ? (
        <div className="flex flex-col gap-3">
          <ContactsCardView contacts={pageRows ?? []} onChanged={handleRowChanged} />
          <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      ) : (
        <ContactsTable contacts={contacts} onChanged={handleRowChanged} />
      )}

      <ContactCreateDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onCreated={handleCreated} />
      <ImportContactsDialog open={importOpen} onOpenChange={handleImportOpenChange} existingContacts={allContactsForImport} onImported={handleImported} />
      {toast}
    </div>
  );
}
