"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BellRing, Building2, FileText, Files, Calendar, CalendarClock, Coins, Columns3, Database, Download, Landmark, ListOrdered, Mail, ToggleRight, Palette, Percent, Scale, Search, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, Input, cn } from "@spine/ui";
import { BusinessPane } from "../app/settings/panes/business-pane";
import { BrandingPane } from "../app/settings/panes/branding-pane";
import { TemplatePane } from "../app/settings/panes/template-pane";
import { CurrencyPane } from "../app/settings/panes/currency-pane";
import { FiscalYearPane } from "../app/settings/panes/fiscal-year-pane";
import { TaxPane } from "../app/settings/panes/tax-pane";
import { GstPane } from "../app/settings/panes/gst-pane";
import { DocumentsPane } from "../app/settings/panes/documents-pane";
import { EmailsPane } from "../app/settings/panes/emails-pane";
import { ModulesPane } from "../app/settings/panes/modules-pane";
import { useModules } from "../lib/modules-context";
import { ownedByOffModule } from "@spine/shared";
import type { TaxProfile } from "@spine/shared";
import { apiClient } from "../lib/api-client";
import { NumberingPane } from "../app/settings/panes/numbering-pane";
import { AccountsPane } from "../app/settings/panes/accounts-pane";
import { OpeningBalancesPane } from "../app/settings/panes/opening-balances-pane";
import { PaymentInstructionsPane } from "../app/settings/panes/payment-instructions-pane";
import { LeadStagesPane } from "../app/settings/panes/lead-stages-pane";
import { RemindersPane } from "../app/settings/panes/reminders-pane";
import { DataPane } from "../app/settings/panes/data-pane";
import { DataExportPane } from "../app/settings/panes/data-export-pane";
import { QuoteConversionGuardPane } from "../app/settings/panes/quote-conversion-guard-pane";
import { DashboardMeetingsScopePane } from "../app/settings/panes/dashboard-meetings-scope-pane";
import { MeetingReminderLeadTimePane } from "../app/settings/panes/meeting-reminder-lead-time-pane";

interface SettingsSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** `close` shuts the dialog, for a pane that links to a page of its own. */
  render: (close: () => void) => React.ReactNode;
  /** Shown only for this tax country (US-TAX-12: GST is India's). */
  country?: string;
}

const SECTIONS: SettingsSection[] = [
  { key: "business", label: "Business profile", icon: <Building2 size={16} />, render: () => <BusinessPane /> },
  { key: "branding", label: "Branding", icon: <Palette size={16} />, render: () => <BrandingPane /> },
  { key: "template", label: "Industry template", icon: <Sparkles size={16} />, render: () => <TemplatePane /> },
  { key: "currency", label: "Currency & locale", icon: <Coins size={16} />, render: () => <CurrencyPane /> },
  { key: "fiscal-year", label: "Financial year", icon: <Calendar size={16} />, render: () => <FiscalYearPane /> },
  { key: "tax", label: "Tax", icon: <Percent size={16} />, render: () => <TaxPane /> },
  // US-TAX-12
  { key: "gst", label: "GST", icon: <FileText size={16} />, render: () => <GstPane />, country: "IN" },
  { key: "numbering", label: "Numbering", icon: <ListOrdered size={16} />, render: () => <NumberingPane /> },
  { key: "accounts", label: "Chart of accounts", icon: <Wallet size={16} />, render: () => <AccountsPane /> },
  // US-RPT-16
  { key: "opening-balances", label: "Opening balances", icon: <Scale size={16} />, render: (close) => <OpeningBalancesPane onOpen={close} /> },
  { key: "payment-instructions", label: "Payment instructions", icon: <Landmark size={16} />, render: () => <PaymentInstructionsPane /> },
  // US-SET-17–US-SET-19
  { key: "documents", label: "Documents", icon: <Files size={16} />, render: () => <DocumentsPane /> },
  // US-SET-21
  { key: "emails", label: "Emails", icon: <Mail size={16} />, render: () => <EmailsPane /> },
  { key: "reminders", label: "Automatic reminders", icon: <BellRing size={16} />, render: () => <RemindersPane /> },
  // US-SET-23
  { key: "modules", label: "Modules", icon: <ToggleRight size={16} />, render: () => <ModulesPane /> },
  { key: "lead-stages", label: "Pipeline stages", icon: <Columns3 size={16} />, render: () => <LeadStagesPane /> },
  {
    key: "quote-conversion-guard",
    label: "Repeat quote conversion",
    icon: <ShieldAlert size={16} />,
    render: () => <QuoteConversionGuardPane />,
  },
  {
    key: "dashboard-meetings-scope",
    label: "Upcoming meetings",
    icon: <CalendarClock size={16} />,
    render: () => <DashboardMeetingsScopePane />,
  },
  {
    key: "meeting-reminder-lead-time",
    label: "Meeting reminders",
    icon: <AlarmClock size={16} />,
    render: () => <MeetingReminderLeadTimePane />,
  },
  // US-SET-15/16 (D-094)
  { key: "data-export", label: "Data export", icon: <Download size={16} />, render: () => <DataExportPane /> },
  { key: "data", label: "Demo data", icon: <Database size={16} />, render: () => <DataPane /> },
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
 *
 * `isOwner` is a defense-in-depth check, not the real security boundary —
 * every settings-mutating API route independently rejects any non-Owner
 * request server-side regardless. AppUserMenu already hides the "Settings"
 * menu item entirely for non-Owners; this additionally refuses to render
 * any pane content if the dialog is somehow still opened (e.g. a future
 * second entry point), rather than trusting the caller alone.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  isOwner,
  initialKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  /** US-SET-15: open on this pane (e.g. "data-export" from the export-ready email's `?settings=` link). */
  initialKey?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState("business");
  // US-TAX-12 — re-read on each pane change, so choosing India under Tax shows GST.
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then((p) => setCountry(p.country ?? null))
      .catch(() => {});
  }, [open, activeKey]);
  // US-SET-24: a switched-off module's settings panes are gone.
  const { modules } = useModules();
  const sections = useMemo(
    () => SECTIONS.filter((s) => (!s.country || s.country === country || s.key === activeKey) && !ownedByOffModule(modules, "settingsPanes", s.key)),
    [country, activeKey, modules],
  );
  useEffect(() => {
    if (open && initialKey && SECTIONS.some((s) => s.key === initialKey)) setActiveKey(initialKey);
  }, [open, initialKey]);

  if (!isOwner) return null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.label.toLowerCase().includes(q));
  }, [query, sections]);

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
        <div className="flex min-h-0 flex-1">
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
            <div className="flex flex-col gap-0.5 overflow-y-auto" data-testid="settings-sections">
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
          <div className="min-w-0 flex-1 overflow-y-auto p-6" data-testid="settings-pane">
            <div className="mx-auto w-full max-w-xl">{active.render(() => handleOpenChange(false))}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
