"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { ContactOption } from "./types";

/**
 * Contact picker for the invoice builder — reuses `Combobox` (search-as-you-
 * type over a potentially long contact list) rather than `Select`, matching
 * quotes/contact-picker.tsx exactly. Duplicated rather than shared, matching
 * that file's own precedent (and contacts/catalog's before it). Fetches
 * `/contacts` itself (no archived contacts offered — an invoice shouldn't be
 * created against a contact the org has archived).
 */
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
      .get<ContactOption[]>("/contacts?picker=1")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const options = useMemo(
    () => contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    [contacts],
  );

  return <Combobox options={options} value={value || undefined} onValueChange={onValueChange} placeholder="Select a contact…" />;
}
