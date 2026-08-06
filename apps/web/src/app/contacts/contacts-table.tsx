"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, DataTable, Spinner, type TableColumn } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { Contact } from "./types";

const TYPE_LABELS: Record<Contact["type"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  both: "Customer & vendor",
};

const columns: TableColumn<Contact>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <Link href={`/contacts/${row.id}`} className="font-medium text-on-surface hover:text-primary hover:underline">
        {row.name}
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
    render: (row) => (row.archivedAt ? <Badge>Archived</Badge> : null),
  },
];

/**
 * Client-side list so a create/archive/restore action can refetch without
 * a full page navigation. Archived contacts are excluded by default —
 * `includeArchived` is a query param the API already supports
 * (contacts.controller.ts) but this pass doesn't surface a toggle for it,
 * matching the task's MUST-only scope (archive exists to unblock delete,
 * not as its own workflow yet).
 */
export function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<Contact[]>("/contacts")
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load contacts.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!contacts) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={contacts}
      rowKey={(row) => row.id}
      searchPlaceholder="Search contacts"
      searchKey={(row) => `${row.name} ${row.email ?? ""} ${row.phone ?? ""}`}
    />
  );
}
