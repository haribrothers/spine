"use client";

import Link from "next/link";
import { Badge } from "@spine/ui";
import { ContactLogo } from "./contact-logo";
import { ContactRowActions } from "./contact-row-actions";
import type { Contact } from "./types";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

/**
 * The denser single-column List view — same data as Table, no search/sort
 * chrome, smaller row height. The zero-contacts case is handled one level
 * up by ContactsExplorer (EmptyState), so this always receives a non-empty
 * `contacts` array.
 */
export function ContactsListView({
  contacts,
  onChanged,
}: {
  contacts: Contact[];
  onChanged: (action: "archived" | "restored" | "deleted", contact: Contact) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {contacts.map((contact) => (
        <li key={contact.id} className="flex items-center gap-3 px-4 py-2.5">
          <ContactLogo name={contact.name} fileId={contact.logoFileId} size="md" editable={false} onUploaded={() => {}} />
          <Link href={`/contacts/${contact.id}`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-on-surface hover:text-primary hover:underline">{contact.name}</span>
              <Badge>{TYPE_LABELS[contact.type]}</Badge>
              {contact.archivedAt && <Badge>Archived</Badge>}
            </div>
            <p className="truncate text-[12px] text-on-surface-muted">
              {contact.email ?? "No email"} {contact.phone ? `· ${contact.phone}` : ""}
            </p>
          </Link>
          <ContactRowActions contact={contact} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}
