"use client";

import { useMemo, useState } from "react";
import { ArrowRight, FileText, HardHat, Plus, Receipt, Users } from "lucide-react";
import { Button, Checkbox, CommandPalette, Kbd, ToggleGroup, ToggleGroupItem, type CommandPaletteGroup } from "@spine/ui";

const ALL: (CommandPaletteGroup & { area: string })[] = [
  { heading: "Actions", area: "all", items: [{ id: "a1", title: "New invoice", subtitle: "Billing", icon: <Plus /> }] },
  { heading: "Contacts", area: "sales", items: [{ id: "c1", title: "Harborview Construction Co.", subtitle: "Customer · Priya Nair · Portland, ME", meta: "Contact", icon: <Users /> }] },
  {
    heading: "Quotes",
    area: "sales",
    items: [
      { id: "q4", title: "QUO-0004", subtitle: "Harborview Construction Co. · $510.00", meta: "Sent", metaTone: "warning", icon: <FileText /> },
      { id: "q1", title: "QUO-0001", subtitle: "Harborview Construction Co. · $48,500.00", meta: "Accepted", metaTone: "success", icon: <FileText /> },
    ],
  },
  { heading: "Jobs", area: "jobs", items: [{ id: "j1", title: "JOB-001 · Marina office fit-out", subtitle: "48 Harbor Way, Portland, ME 04101", meta: "Active", icon: <HardHat /> }] },
  { heading: "Invoices", area: "billing", items: [{ id: "i10", title: "INV-0010", subtitle: "Harborview Construction Co. · $9,700.00 due", meta: "Overdue", metaTone: "danger", icon: <Receipt /> }] },
];

/** A working palette over sample data; the app's own palette asks the API instead of filtering here. */
export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("harbor");
  const [area, setArea] = useState("all");
  const [archived, setArchived] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL.filter((g) => area === "all" || g.area === area).map((g) => {
      const items = g.items.filter((i) => `${i.title} ${i.subtitle}`.toLowerCase().includes(q) || g.heading === "Actions");
      // US-OPS-40: a link row ends each group of records.
      return g.heading === "Actions" ? { ...g, items } : { ...g, items: items.length ? [...items, { id: `all-${g.heading}`, title: `See all ${g.heading.toLowerCase()} matching “${query.trim()}”`, icon: <ArrowRight />, variant: "link" as const }] : [] };
    });
  }, [query, area]);

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
        placeholder="Search records, pages and settings"
        groups={groups}
        highlight={query.trim().length >= 2 ? query.trim() : undefined}
        onSelect={(item) => {
          setPicked(item.title);
          setOpen(false);
        }}
        hint="Type a name, a number like INV-0010 or an amount like 2,389.50."
        emptyMessage={query.trim().length >= 2 ? `No results for “${query.trim()}”` : undefined}
        toolbar={
          <ToggleGroup type="single" aria-label="Search in" value={area} onValueChange={(v) => v && setArea(v)}>
            {[
              ["all", "All"],
              ["sales", "Sales"],
              ["jobs", "Jobs"],
              ["billing", "Billing"],
            ].map(([value, label]) => (
              <ToggleGroupItem key={value} value={value!} size="sm" tooltip={false}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
        footer={
          <>
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
            <label className="ml-auto flex items-center gap-2 font-medium text-on-surface">
              <Checkbox checked={archived} onCheckedChange={(v) => setArchived(v === true)} />
              Include archived
            </label>
          </>
        }
      />
    </div>
  );
}
