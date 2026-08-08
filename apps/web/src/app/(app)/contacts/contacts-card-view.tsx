"use client";

import Link from "next/link";
import { Badge, Card } from "@spine/ui";
import { ContactLogo } from "./contact-logo";
import { ContactRowActions } from "./contact-row-actions";
import type { Contact } from "./types";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

/**
 * A grid of cards — logo/avatar, name, type badge, email/phone, corner
 * dropdown trigger for row actions. The zero-contacts case is handled one
 * level up by ContactsExplorer (EmptyState), so this always receives a
 * non-empty `contacts` array.
 */
export function ContactsCardView({
  contacts,
  onChanged,
}: {
  contacts: Contact[];
  onChanged: (action: "archived" | "restored" | "deleted", contact: Contact) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((contact) => (
        <Card key={contact.id} className="relative flex flex-col gap-3">
          <div className="absolute right-3 top-3">
            <ContactRowActions contact={contact} onChanged={onChanged} />
          </div>
          <Link href={`/contacts/${contact.id}`} className="flex flex-col items-start gap-3">
            <ContactLogo name={contact.name} fileId={contact.logoFileId} size="lg" editable={false} onUploaded={() => {}} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium text-on-surface hover:text-primary hover:underline">{contact.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>{TYPE_LABELS[contact.type]}</Badge>
                {contact.archivedAt && <Badge>Archived</Badge>}
              </div>
              <p className="mt-2 truncate text-[12px] text-on-surface-muted">{contact.email ?? "No email"}</p>
              {contact.phone && <p className="truncate text-[12px] text-on-surface-muted">{contact.phone}</p>}
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
}
