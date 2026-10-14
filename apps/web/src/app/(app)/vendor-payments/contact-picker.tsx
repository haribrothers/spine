"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { ContactOption } from "./types";

/** Filtered to vendor-type contacts only (`?type=vendor&type=both`), mirroring vendor-bills/contact-picker.tsx's identical reasoning — a vendor payment can only ever go to a contact the org can actually pay. Duplicated rather than shared, matching this codebase's established per-feature-folder convention. */
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
      .get<ContactOption[]>("/contacts?picker=1&type=vendor&type=both")
      .then(setContacts)
      .catch(() => {});
  }, []);

  const options = useMemo(
    () => contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    [contacts],
  );

  return <Combobox options={options} value={value || undefined} onValueChange={onValueChange} placeholder="Select a vendor…" />;
}
