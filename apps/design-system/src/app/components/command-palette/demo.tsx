"use client";

import { useMemo, useState } from "react";
import { Button, CommandPalette, Kbd, type CommandPaletteGroup } from "@spine/ui";

const ALL: CommandPaletteGroup[] = [
  { heading: "Contacts", items: [{ id: "c1", title: "Harborview Construction Co.", subtitle: "Customer · Priya Nair · Portland, ME", meta: "Contact" }] },
  {
    heading: "Quotes",
    items: [
      { id: "q4", title: "QUO-0004", subtitle: "Harborview Construction Co. · $510.00", meta: "Sent" },
      { id: "q1", title: "QUO-0001", subtitle: "Harborview Construction Co. · $48,500.00", meta: "Accepted" },
    ],
  },
  { heading: "Jobs", items: [{ id: "j1", title: "JOB-001 · Marina office fit-out", subtitle: "48 Harbor Way, Portland, ME 04101", meta: "Active" }] },
  { heading: "Invoices", items: [{ id: "i10", title: "INV-0010", subtitle: "Harborview Construction Co. · $9,700.00 due", meta: "Overdue" }] },
];

/** A working palette over sample data; the app's own palette asks the API instead of filtering here. */
export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("harbor");
  const [picked, setPicked] = useState<string | null>(null);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL.map((g) => ({ ...g, items: g.items.filter((i) => `${i.title} ${i.subtitle}`.toLowerCase().includes(q)) }));
  }, [query]);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Search <Kbd>⌘K</Kbd>
      </Button>
      {picked && <span className="text-[13px] text-on-surface-muted">Opened {picked}</span>}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        label="Search"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search contacts, quotes, invoices, jobs…"
        groups={groups}
        onSelect={(item) => {
          setPicked(item.title);
          setOpen(false);
        }}
        hint="Type at least 2 characters."
        emptyMessage={query.trim().length >= 2 ? `No results for “${query.trim()}”` : undefined}
        footer={
          <>
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span className="ml-auto">Searches sample records</span>
          </>
        }
      />
    </div>
  );
}
