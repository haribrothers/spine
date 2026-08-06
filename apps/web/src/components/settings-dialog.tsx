"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Coins,
  ListOrdered,
  Percent,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, Input, cn } from "@spine/ui";
import { BusinessPane } from "../app/settings/panes/business-pane";
import { TemplatePane } from "../app/settings/panes/template-pane";
import { CurrencyPane } from "../app/settings/panes/currency-pane";
import { FiscalYearPane } from "../app/settings/panes/fiscal-year-pane";
import { TaxPane } from "../app/settings/panes/tax-pane";
import { NumberingPane } from "../app/settings/panes/numbering-pane";
import { AccountsPane } from "../app/settings/panes/accounts-pane";
import { TeamPane } from "../app/settings/panes/team-pane";

interface SettingsSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}

const SECTIONS: SettingsSection[] = [
  { key: "business", label: "Business profile", icon: <Building2 size={16} />, render: () => <BusinessPane /> },
  { key: "template", label: "Industry template", icon: <Sparkles size={16} />, render: () => <TemplatePane /> },
  { key: "currency", label: "Currency & locale", icon: <Coins size={16} />, render: () => <CurrencyPane /> },
  { key: "fiscal-year", label: "Financial year", icon: <Calendar size={16} />, render: () => <FiscalYearPane /> },
  { key: "tax", label: "Tax", icon: <Percent size={16} />, render: () => <TaxPane /> },
  { key: "numbering", label: "Numbering", icon: <ListOrdered size={16} />, render: () => <NumberingPane /> },
  { key: "accounts", label: "Chart of accounts", icon: <Wallet size={16} />, render: () => <AccountsPane /> },
  { key: "team", label: "Team", icon: <Users size={16} />, render: () => <TeamPane /> },
];

/**
 * The Settings dialog — a two-pane overlay (left section list + search,
 * right content pane) replacing the old /settings/* routed pages. There is
 * deliberately no per-section URL (confirmed with the user: "Dialog only,
 * no URLs") — the currently-selected section is local `useState`, not
 * derived from the route, and resets to "business" whenever the dialog is
 * reopened.
 *
 * Controlled via `open`/`onOpenChange` from the caller (AppUserMenu) rather
 * than using DialogTrigger internally — Radix's DropdownMenu closes and
 * unmounts its items (including any DialogTrigger inside one) as soon as a
 * selection is made, which tears down the Dialog before it can open. The
 * standard workaround is to keep the Dialog's open state external to the
 * dropdown and flip it from the menu item's onSelect instead of nesting a
 * trigger inside the item.
 */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState("business");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => s.label.toLowerCase().includes(q));
  }, [query]);

  const active = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0]!;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset to defaults on close so reopening always starts from a known
      // state rather than whatever the user last had selected/typed.
      setQuery("");
      setActiveKey("business");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full min-h-0">
          <div className="flex w-64 shrink-0 flex-col gap-3 border-r border-border p-4">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                className="h-8 pl-8 text-[13px]"
              />
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto">
              <span className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-muted">
                Organisation
              </span>
              {filtered.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveKey(section.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors",
                    section.key === activeKey
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-on-surface hover:bg-surface-sunken",
                  )}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <span className="px-2 py-1.5 text-[13px] text-on-surface-muted">No matching settings.</span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto w-full max-w-xl">{active.render()}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
