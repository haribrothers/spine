"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@spine/ui";
import { apiClient } from "../../lib/api-client";
import type { ContactOption } from "./types";

/**
 * Contact picker for the quote builder — reuses `Combobox` (search-as-you-
 * type over a potentially long contact list) rather than `Select`, per the
 * task brief. Fetches `/contacts` itself (no archived contacts offered —
 * a quote shouldn't be created against a contact the org has archived).
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
