"use client";

import Link from "next/link";
import { Badge, Card } from "@spine/ui";
import { ContactLogo } from "./contact-logo";
import { ContactRowActions } from "./contact-row-actions";
import type { Contact } from "./types";
import { t as translate, useT } from "../../../lib/i18n";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: translate("contacts.common.typeCustomer"),
  vendor: translate("contacts.common.typeVendor"),
  both: translate("contacts.common.typeBoth"),
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
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {contacts.map((contact) => (
        <Card key={contact.id} className="relative flex min-w-0 flex-col gap-3" data-testid="contact-card">
          <div className="absolute right-3 top-3">
            <ContactRowActions contact={contact} onChanged={onChanged} />
          </div>
          <Link href={`/contacts/${contact.id}`} className="flex min-w-0 flex-col items-start gap-3">
            <ContactLogo name={contact.name} fileId={contact.logoFileId} size="lg" editable={false} onUploaded={() => {}} />
            {/* US-CRM-21: the name wraps to two lines, clear of the menu; email and phone stay on one line. All cut short with the full text on hover. */}
            <div className="flex w-full min-w-0 flex-col">
              <span className="line-clamp-2 break-words pr-6 font-medium text-on-surface hover:text-primary hover:underline" title={contact.name}>
                {contact.name}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge>{TYPE_LABELS[contact.type]}</Badge>
                {contact.archivedAt && <Badge>{t("contacts.common.archived")}</Badge>}
              </div>
              <p className="mt-2 truncate text-[12px] text-on-surface-muted" title={contact.email ?? undefined}>
                {contact.email ?? t("contacts.common.noEmail")}
              </p>
              {contact.phone && (
                <p className="truncate text-[12px] text-on-surface-muted" title={contact.phone}>
                  {contact.phone}
                </p>
              )}
            </div>
          </Link>
        </Card>
      ))}
    </div>
  );
}
