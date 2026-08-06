"use client";

import { ToggleGroup, ToggleGroupItem } from "@spine/ui";
import { LayoutGrid, List, Table2 } from "lucide-react";

export type ContactView = "table" | "list" | "card";

export const VIEW_STORAGE_KEY = "spine.contacts.view";

/** Table / List / Card toggle — persistence lives in the parent page (localStorage, same pattern as app-layout.tsx's sidebar-collapse state). */
export function ContactsViewSwitcher({ value, onChange }: { value: ContactView; onChange: (view: ContactView) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as ContactView)}
      aria-label="View"
    >
      <ToggleGroupItem value="table" aria-label="Table view">
        <Table2 size={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List size={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="card" aria-label="Card view">
        <LayoutGrid size={16} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
