"use client";

import Link from "next/link";
import { Badge, DataTable, type TableColumn } from "@spine/ui";
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
 * The Table view — same `DataTable` this module always used, now with an
 * "Actions" column hosting the shared row-level menu (Edit/Archive/Delete)
 * per Phase 2. Type/archived filtering happens one level up (the list page
 * owns the `MultiSelect` filters and passes already-filtered `data` in)
 * rather than duplicated per view.
 */
export function ContactsTable({
  contacts,
  onChanged,
  page,
  onPageChange,
  toolbarStart,
}: {
  contacts: Contact[];
  onChanged: (action: "archived" | "restored" | "deleted", contact: Contact) => void;
  /** US-CRM-23: the page lives in the address, and the search row is the page's own (it covers every view). */
  page: number;
  onPageChange: (page: number) => void;
  toolbarStart: React.ReactNode;
}) {
  const t = useT();
  const columns: TableColumn<Contact>[] = [
    {
      key: "name",
      header: t("contacts.common.name"),
      render: (row) => (
        <Link href={`/contacts/${row.id}`} className="flex min-w-0 max-w-[15rem] items-center gap-2.5 wide-plus:max-w-[20rem]">
          <ContactLogo name={row.name} fileId={row.logoFileId} size="md" editable={false} onUploaded={() => {}} />
          {/* US-CRM-21: long names and emails are cut short, the full text on hover, so every column fits. */}
          <span className="truncate font-medium text-on-surface hover:text-primary hover:underline" title={row.name}>
            {row.name}
          </span>
        </Link>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "type",
      header: t("contacts.common.type"),
      render: (row) => <Badge>{TYPE_LABELS[row.type]}</Badge>,
      sortValue: (row) => row.type,
    },
    {
      key: "email",
      header: t("contacts.common.email"),
      render: (row) =>
        row.email ? (
          <span className="block max-w-[13rem] truncate wide-plus:max-w-[16rem]" title={row.email}>
            {row.email}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "phone",
      header: t("contacts.common.phone"),
      render: (row) => <span className="whitespace-nowrap">{row.phone ?? "—"}</span>,
    },
    {
      key: "status",
      header: t("contacts.common.status"),
      render: (row) =>
        row.archivedAt ? (
          <Badge>{t("contacts.common.archived")}</Badge>
        ) : (
          <Badge className="bg-transparent text-on-surface-muted">{t("contacts.common.active")}</Badge>
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
      toolbarStart={toolbarStart}
      page={page}
      onPageChange={onPageChange}
      configurablePageSize
    />
  );
}
