"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import type { ContactOption } from "./types";

/**
 * Contact picker for the vendor bill builder — filtered to vendor-type
 * contacts only (`?type=vendor&type=both`), unlike invoices/contact-picker.tsx
 * which has no filter (every contact there is fair game for a customer
 * document). A vendor bill can only ever be raised against a contact the
 * org can actually pay, per ContactType's own "customer" | "vendor" | "both"
 * shape. Duplicated rather than shared, matching this codebase's established
 * per-feature-folder convention (contact-picker.tsx is duplicated the
 * same way across invoices/payments/quotes).
 */
export function ContactPicker({
  value,
  onValueChange,
  refreshKey = 0,
}: {
  value: string;
  onValueChange: (contactId: string) => void;
  /** US-AI-08 — bump to read the vendors again (one was just added). */
  refreshKey?: number;
}) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  useEffect(() => {
    apiClient
      .get<ContactOption[]>("/contacts?picker=1&type=vendor&type=both")
      .then(setContacts)
      .catch(() => {});
  }, [refreshKey]);

  const options = useMemo(
    () => contacts.filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name })),
    [contacts],
  );

  return <Combobox options={options} value={value || undefined} onValueChange={onValueChange} placeholder="Select a vendor…" />;
}
