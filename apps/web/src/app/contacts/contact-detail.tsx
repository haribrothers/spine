"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@spine/ui";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type { Activity, Contact, ContactType, Lead, SpineFile } from "./types";
import { AddressesSection } from "./addresses-section";
import { ContactLogo } from "./contact-logo";
import { ContactPersonsSection } from "./contact-persons-section";
import { LeadsSection } from "./leads-section";
import { ActivitiesSection } from "./activities-section";
import { HistorySection } from "./history-section";
import { useEntityToast } from "./entity-toast";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "both", label: "Customer & vendor" },
];

/**
 * S-01.3's deferred-scope note: PRD SHOULDs a unified timeline (quotes,
 * invoices, payments, activities) here — quotes/invoices don't exist yet,
 * so this shows only what's real: the contact's own fields, persons,
 * addresses, leads, and activities. Not a fake timeline stitched from
 * nothing.
 *
 * Phase 3 redesign (this session, replacing the two-column layout from the
 * immediately-prior session): a back button + header (logo/avatar, name,
 * badges, primary actions) at the top, then Tabs — "Contact persons",
 * "Addresses", "Leads", "Activities" — host the same section components as
 * before, unchanged in their own internal CRUD logic (edit/archive/delete
 * for the contact itself; add/remove for each tab's entity). No separate
 * "Overview" tab: the contact's own editable fields live in the header
 * (inline edit, same as before), so a redundant Overview tab hosting only
 * a repeat of those same fields was skipped per the task brief's own
 * "or skip a redundant Overview tab — your call" allowance.
 */
export function ContactDetail({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<ContactType>("customer");
  const [isCompany, setIsCompany] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");

  const { show: showToast, toast } = useEntityToast();

  async function reloadContact() {
    try {
      const row = await apiClient.get<Contact>(`/contacts/${contactId}`);
      setContact(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load contact.");
    }
  }

  function reloadLeads() {
    // The leads list endpoint only filters by ?stage, not contactId (per
    // apps/api/src/modules/contacts/leads.controller.ts) — filtering
    // client-side here rather than adding a server-side param this pass
    // doesn't otherwise need, since a single contact's lead count is small.
    apiClient.get<Lead[]>("/leads").then((rows) => setLeads(rows.filter((l) => l.contactId === contactId)));
  }

  function reloadActivities() {
    apiClient.get<Activity[]>(`/activities?contactId=${contactId}`).then(setActivities);
  }

  useEffect(() => {
    reloadContact();
    reloadLeads();
    reloadActivities();
  }, [contactId]);

  useEffect(() => {
    // One-shot flag set by contact-form.tsx right before it navigates here —
    // the create form has no moment of its own to show a toast since it
    // redirects immediately, so the detail page shows it instead.
    if (typeof window === "undefined") return;
    const createdName = window.sessionStorage.getItem("spine:contact-created");
    if (createdName) {
      window.sessionStorage.removeItem("spine:contact-created");
      showToast("Contact created", `${createdName} has been added to your contacts.`);
    }
  }, []);

  function startEdit() {
    if (!contact) return;
    setType(contact.type);
    setIsCompany(contact.isCompany);
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setTaxId(contact.taxId ?? "");
    setWebsite(contact.website ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await apiClient.put(`/contacts/${contactId}`, {
        type,
        isCompany,
        name,
        email: email || null,
        phone: phone || null,
        taxId: taxId || null,
        website: website || null,
      });
      setEditing(false);
      await reloadContact();
      showToast("Contact updated", `${name} has been saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUploaded(file: SpineFile) {
    await apiClient.put(`/contacts/${contactId}`, { logoFileId: file.id });
    await reloadContact();
  }

  async function handleArchive() {
    setBusy(true);
    try {
      await apiClient.post(`/contacts/${contactId}/archive`);
      await reloadContact();
      showToast("Contact archived", `${contact?.name ?? "This contact"} has been archived.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    try {
      await apiClient.post(`/contacts/${contactId}/restore`);
      await reloadContact();
      showToast("Contact restored", `${contact?.name ?? "This contact"} is active again.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setDeleteError(null);
    try {
      const deletedName = contact?.name ?? "Contact";
      await apiClient.delete(`/contacts/${contactId}`);
      // Toast fires from the list page after this navigation, not here —
      // this page is about to unmount, so a one-shot flag hands the message
      // off the same way contact-form.tsx does for create.
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("spine:contact-deleted", deletedName);
      }
      router.push("/contacts");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete contact.",
      );
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const archived = Boolean(contact.archivedAt);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      {/* Explicit back button — Breadcrumb (in the page's own AppShellHeader,
          above this component) already offers "Contacts", but a one-click
          back affordance right next to the identity it returns from reads
          clearer for a detail page one level deep, matching common CRM
          detail-page conventions (Attio/Twenty/Jobber references from the
          prior pass). */}
      <button
        type="button"
        onClick={() => router.push("/contacts")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to contacts
      </button>

      {/* Header row: logo + identity + badges on the left, primary actions top-right. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-start gap-4">
          <ContactLogo name={contact.name} fileId={contact.logoFileId} size="lg" editable onUploaded={handleLogoUploaded} />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold text-on-surface">{contact.name}</h2>
              <Badge>{TYPE_LABELS[contact.type]}</Badge>
              {contact.isCompany && <Badge>Company</Badge>}
              {archived && <Badge>Archived</Badge>}
            </div>
            <p className="text-[13px] text-on-surface-muted">
              {contact.email ?? "No email"} {contact.phone ? `· ${contact.phone}` : ""}
            </p>
            {(contact.taxId || contact.website) && (
              <p className="text-[13px] text-on-surface-muted">
                {contact.taxId ? `Tax ID: ${contact.taxId}` : ""}
                {contact.taxId && contact.website ? " · " : ""}
                {contact.website ? (
                  <a href={contact.website} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                    {contact.website}
                  </a>
                ) : (
                  ""
                )}
              </p>
            )}
          </div>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            {/* Edit is the single primary (filled) action per docs/DESIGN.md; archive/restore/delete are secondary or danger. */}
            <Button variant="primary" onClick={startEdit}>
              Edit
            </Button>
            {archived ? (
              <Button variant="secondary" onClick={handleRestore} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Restore"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleArchive} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Archive"}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="danger" disabled={busy}>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {contact.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the contact and its persons/addresses. This cannot be undone. If this
                    contact has any financial ledger history, deletion will be blocked — archive it instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {deleteError && (
        <Alert variant="critical">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {editing && (
        <div className="flex flex-col gap-4 rounded-lg border border-border-strong bg-surface p-5">
          <h3 className="text-[14px] font-semibold text-on-surface">Edit contact</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type" required>
              {(field) => (
                <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-[13px] text-on-surface">
                <Checkbox checked={isCompany} onCheckedChange={(v) => setIsCompany(v === true)} />
                This is a company, not an individual
              </label>
            </div>

            <FormField label={isCompany ? "Company name" : "Full name"} required>
              {(field) => <Input {...field} value={name} onChange={(e) => setName(e.target.value)} required />}
            </FormField>

            <FormField label="Email">
              {(field) => <Input {...field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </FormField>

            <FormField label="Phone">
              {(field) => <Input {...field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
            </FormField>

            <FormField label="Tax ID">
              {(field) => <Input {...field} value={taxId} onChange={(e) => setTaxId(e.target.value)} />}
            </FormField>

            <FormField label="Website">
              {(field) => <Input {...field} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />}
            </FormField>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" disabled={saving || !name} onClick={handleSaveEdit}>
              {saving ? <Spinner size="sm" /> : "Save"}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="persons">
        <TabsList>
          <TabsTrigger value="persons">Contact persons</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="persons">
          <ContactPersonsSection
            contact={contact}
            onSaved={reloadContact}
            onCreated={() => showToast("Contact person added", "The new contact person has been saved.")}
          />
        </TabsContent>
        <TabsContent value="addresses">
          <AddressesSection
            contact={contact}
            onSaved={reloadContact}
            onCreated={() => showToast("Address added", "The new address has been saved.")}
          />
        </TabsContent>
        <TabsContent value="leads">
          <LeadsSection
            contactId={contactId}
            leads={leads}
            onChanged={reloadLeads}
            onCreated={() => showToast("Lead added", "The new lead has been saved.")}
          />
        </TabsContent>
        <TabsContent value="activities">
          <ActivitiesSection
            contactId={contactId}
            activities={activities}
            onChanged={reloadActivities}
            onCreated={() => showToast("Activity logged", "The activity has been saved.")}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistorySection contactId={contactId} />
        </TabsContent>
      </Tabs>

      {toast}
    </div>
  );
}
