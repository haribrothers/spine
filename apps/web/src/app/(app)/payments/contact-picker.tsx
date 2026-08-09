"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { ContactOption } from "./types";

/** Duplicated from invoices/quotes' own contact-picker.tsx, matching that file's own stated precedent (each feature folder owns a small copy rather than importing across folders). */
export function ContactPicker({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (contactId: string) => void;
}) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const options = useMemo(
    () => contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    [contacts],
  );

  return <Combobox options={options} value={value || undefined} onValueChange={onValueChange} placeholder="Select a contact…" />;
}
