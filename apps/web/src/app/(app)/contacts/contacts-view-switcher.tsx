"use client";

import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { LayoutGrid, List, Table2 } from "lucide-react";
import { useT } from "../../../lib/i18n";

export type ContactView = "table" | "list" | "card";

export const VIEW_STORAGE_KEY = "spine.contacts.view";

/** Table / List / Card toggle — persistence lives in the parent page (localStorage, same pattern as app-layout.tsx's sidebar-collapse state). */
export function ContactsViewSwitcher({ value, onChange }: { value: ContactView; onChange: (view: ContactView) => void }) {
  const t = useT();
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as ContactView)}
      aria-label={t("contacts.viewSwitcher.label")}
    >
      <ToggleGroupItem value="table" aria-label={t("contacts.viewSwitcher.table")}>
        <Table2 size={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label={t("contacts.viewSwitcher.list")}>
        <List size={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="card" aria-label={t("contacts.viewSwitcher.card")}>
        <LayoutGrid size={16} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
