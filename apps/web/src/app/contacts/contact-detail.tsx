"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Spinner } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { Activity, Contact, Lead } from "./types";
import { AddressesSection } from "./addresses-section";
import { ContactPersonsSection } from "./contact-persons-section";
import { LeadsSection } from "./leads-section";
import { ActivitiesSection } from "./activities-section";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

/**
 * S-01.3's deferred-scope note: PRD SHOULDs a unified timeline (quotes,
 * invoices, payments, activities) here — quotes/invoices don't exist yet,
 * so this shows only what's real: the contact's own fields, persons,
 * addresses, leads, and activities. Not a fake timeline stitched from
 * nothing.
 */
export function ContactDetail({ contactId }: { contactId: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-on-surface">{contact.name}</h2>
          <Badge>{TYPE_LABELS[contact.type]}</Badge>
          {contact.archivedAt && <Badge>Archived</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-on-surface-muted">Email</dt>
          <dd className="text-on-surface">{contact.email ?? "—"}</dd>
          <dt className="text-on-surface-muted">Phone</dt>
          <dd className="text-on-surface">{contact.phone ?? "—"}</dd>
        </dl>
      </div>

      <ContactPersonsSection contact={contact} onSaved={reloadContact} />
      <AddressesSection contact={contact} onSaved={reloadContact} />
      <LeadsSection contactId={contactId} leads={leads} onChanged={reloadLeads} />
      <ActivitiesSection contactId={contactId} activities={activities} onChanged={reloadActivities} />
    </div>
  );
}
