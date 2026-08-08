"use client";

import Link from "next/link";
import { Badge, DataTable, type TableColumn } from "@spine/ui";
import { ContactLogo } from "./contact-logo";
import { ContactRowActions } from "./contact-row-actions";
import type { Contact } from "./types";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

/**
 * The Table view — same `DataTable` this module always used, now with an
 * "Actions" column hosting the shared row-level menu (Edit/Archive/Delete)
 * per Phase 2. Type/archived filtering happens one level up (the list page
 * owns the `MultiSelect` filters and passes already-filtered `data` in)
 * rather than duplicated per view.
 */
export function ContactsTable({
  contacts,
  onChanged,
}: {
  contacts: Contact[];
  onChanged: (action: "archived" | "restored" | "deleted", contact: Contact) => void;
}) {
  const columns: TableColumn<Contact>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/contacts/${row.id}`} className="flex items-center gap-2.5">
          <ContactLogo name={row.name} fileId={row.logoFileId} size="md" editable={false} onUploaded={() => {}} />
          <span className="font-medium text-on-surface hover:text-primary hover:underline">{row.name}</span>
        </Link>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <Badge>{TYPE_LABELS[row.type]}</Badge>,
      sortValue: (row) => row.type,
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email ?? "—",
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.archivedAt ? (
          <Badge>Archived</Badge>
        ) : (
          <Badge className="bg-transparent text-on-surface-muted">Active</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end">
          <ContactRowActions contact={row} onChanged={onChanged} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={contacts}
      rowKey={(row) => row.id}
      searchPlaceholder="Search contacts"
      searchKey={(row) => `${row.name} ${row.email ?? ""} ${row.phone ?? ""}`}
      configurablePageSize
    />
  );
}
