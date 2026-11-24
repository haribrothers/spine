"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowUpRight,
  Bell,
  BellRing,
  Bot,
  Building2,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  Columns3,
  Database,
  Download,
  Files,
  FileText,
  History,
  Info,
  KeyRound,
  Landmark,
  ListOrdered,
  Mail,
  Mails,
  Palette,
  Percent,
  Plug,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  ToggleRight,
  type LucideIcon,
  UserCog,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button, Dialog, DialogContent, DialogTitle, Input, cn, useConfirm } from "@spine/ui";
import { ownedByOffModule, type TaxProfile } from "@spine/shared";
import { useModules } from "../lib/modules-context";
import { useAccount } from "../lib/account-context";
import { apiClient } from "../lib/api-client";
import { SettingsDirtyContext } from "../lib/settings-dirty";
import { t, useT } from "../lib/i18n";
import { AccountProfilePane } from "../app/settings/panes/account-profile-pane";
import { AccountSecurityPane } from "../app/settings/panes/account-security-pane";
import { AccountNotificationsPane } from "../app/settings/panes/account-notifications-pane";
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
import { AiPane } from "../app/settings/panes/ai-pane";
import { AgentsPane } from "../app/settings/panes/agents-pane";
import { MyAgentsPane } from "../app/settings/panes/my-agents-pane";
import { AboutPane } from "../app/settings/panes/about-pane";
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

/** US-SET-31 (D-236) — the groups, in the order the list shows them. */
export const SETTINGS_GROUPS = [
  { key: "account", label: t("settings.groups.account") },
  { key: "business", label: t("settings.groups.business") },
  { key: "money", label: t("settings.groups.money") },
  { key: "documents", label: t("settings.groups.documents") },
  { key: "sales", label: t("settings.groups.sales") },
  { key: "data", label: t("settings.groups.data") },
  { key: "team", label: t("settings.groups.team") },
] as const;
type GroupKey = (typeof SETTINGS_GROUPS)[number]["key"];

export interface SettingsSection {
  key: string;
  label: string;
  icon: LucideIcon;
  group: GroupKey;
  /** `close` shuts the dialog, for a pane that links to a page of its own. */
  render?: (close: () => void) => React.ReactNode;
  /** A Team link: closes Settings and opens the page (US-SET-31). */
  href?: string;
  /** Shown only for this tax country (US-TAX-12: GST is India's). */
  country?: string;
  /** US-SET-34 — what the pane contains, for search. */
  keywords: string[];
  /** Saves as each control changes, so it never has unsaved changes (US-SET-33). */
  savesOnChange?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  // US-SET-30: Your account — every role.
  { key: "profile", label: t("settings.sections.profile.label"), icon: UserRound, group: "account", render: () => <AccountProfilePane />, keywords: [...t("settings.sections.profile.keywords", { returnObjects: true })] },
  { key: "security", label: t("settings.sections.security.label"), icon: KeyRound, group: "account", render: () => <AccountSecurityPane />, keywords: [...t("settings.sections.security.keywords", { returnObjects: true })] },
  { key: "notifications", label: t("settings.sections.notifications.label"), icon: Bell, group: "account", render: () => <AccountNotificationsPane />, keywords: [...t("settings.sections.notifications.keywords", { returnObjects: true })], savesOnChange: true },
  // US-MCP-04: each person's own agents; gone while Connected agents is off (its module owns the pane).
  { key: "my-connected-agents", label: t("settings.sections.myConnectedAgents.label"), icon: Plug, group: "account", render: () => <MyAgentsPane />, keywords: [...t("settings.sections.myConnectedAgents.keywords", { returnObjects: true })], savesOnChange: true },
  // US-OPS-52: the version, and "Beta" on a pre-release.
  { key: "about", label: t("settings.sections.about.label"), icon: Info, group: "account", render: () => <AboutPane />, keywords: [...t("settings.sections.about.keywords", { returnObjects: true })] },
  // Business
  { key: "business", label: t("settings.sections.business.label"), icon: Building2, group: "business", render: () => <BusinessPane />, keywords: [...t("settings.sections.business.keywords", { returnObjects: true })] },
  { key: "branding", label: t("settings.sections.branding.label"), icon: Palette, group: "business", render: () => <BrandingPane />, keywords: [...t("settings.sections.branding.keywords", { returnObjects: true })] },
  { key: "template", label: t("settings.sections.template.label"), icon: Sparkles, group: "business", render: () => <TemplatePane />, keywords: [...t("settings.sections.template.keywords", { returnObjects: true })] },
  { key: "currency", label: t("settings.sections.currency.label"), icon: Coins, group: "business", render: () => <CurrencyPane />, keywords: [...t("settings.sections.currency.keywords", { returnObjects: true })] },
  // US-SET-23
  { key: "modules", label: t("settings.sections.modules.label"), icon: ToggleRight, group: "business", render: () => <ModulesPane />, keywords: [...t("settings.sections.modules.keywords", { returnObjects: true })] },
  // US-AI-01, US-AI-02 (D-242): after Modules; the Bot icon, since Industry template has Sparkles.
  { key: "ai", label: t("settings.sections.ai.label"), icon: Bot, group: "business", render: () => <AiPane />, keywords: [...t("settings.sections.ai.keywords", { returnObjects: true })] },
  // US-MCP-02 (D-256): outside agents, switched in their own pane like AI.
  { key: "agents", label: t("settings.sections.agents.label"), icon: Plug, group: "business", render: () => <AgentsPane />, keywords: [...t("settings.sections.agents.keywords", { returnObjects: true })], savesOnChange: true },
  // Money & tax
  { key: "fiscal-year", label: t("settings.sections.fiscalYear.label"), icon: Calendar, group: "money", render: () => <FiscalYearPane />, keywords: [...t("settings.sections.fiscalYear.keywords", { returnObjects: true })] },
  { key: "tax", label: t("settings.sections.tax.label"), icon: Percent, group: "money", render: () => <TaxPane />, keywords: [...t("settings.sections.tax.keywords", { returnObjects: true })] },
  // US-TAX-12: India only.
  { key: "gst", label: t("settings.sections.gst.label"), icon: FileText, group: "money", render: () => <GstPane />, country: "IN", keywords: [...t("settings.sections.gst.keywords", { returnObjects: true })] },
  { key: "accounts", label: t("settings.sections.accounts.label"), icon: Wallet, group: "money", render: () => <AccountsPane />, keywords: [...t("settings.sections.accounts.keywords", { returnObjects: true })] },
  // US-RPT-16 (D-137)
  { key: "opening-balances", label: t("settings.sections.openingBalances.label"), icon: Scale, group: "money", render: (close) => <OpeningBalancesPane onOpen={close} />, keywords: [...t("settings.sections.openingBalances.keywords", { returnObjects: true })] },
  { key: "payment-instructions", label: t("settings.sections.paymentInstructions.label"), icon: Landmark, group: "money", render: () => <PaymentInstructionsPane />, keywords: [...t("settings.sections.paymentInstructions.keywords", { returnObjects: true })] },
  // Documents & emails
  { key: "numbering", label: t("settings.sections.numbering.label"), icon: ListOrdered, group: "documents", render: () => <NumberingPane />, keywords: [...t("settings.sections.numbering.keywords", { returnObjects: true })] },
  // US-SET-17 to US-SET-20
  { key: "documents", label: t("settings.sections.documents.label"), icon: Files, group: "documents", render: () => <DocumentsPane />, keywords: [...t("settings.sections.documents.keywords", { returnObjects: true })] },
  // US-SET-21/22
  { key: "emails", label: t("settings.sections.emails.label"), icon: Mail, group: "documents", render: (close) => <EmailsPane onOpenLog={close} />, keywords: [...t("settings.sections.emails.keywords", { returnObjects: true })] },
  { key: "reminders", label: t("settings.sections.reminders.label"), icon: BellRing, group: "documents", render: () => <RemindersPane />, keywords: [...t("settings.sections.reminders.keywords", { returnObjects: true })] },
  // Sales & meetings
  { key: "lead-stages", label: t("settings.sections.leadStages.label"), icon: Columns3, group: "sales", render: () => <LeadStagesPane />, keywords: [...t("settings.sections.leadStages.keywords", { returnObjects: true })] },
  { key: "quote-conversion-guard", label: t("settings.sections.quoteConversionGuard.label"), icon: ShieldAlert, group: "sales", render: () => <QuoteConversionGuardPane />, keywords: [...t("settings.sections.quoteConversionGuard.keywords", { returnObjects: true })] },
  { key: "dashboard-meetings-scope", label: t("settings.sections.dashboardMeetingsScope.label"), icon: CalendarClock, group: "sales", render: () => <DashboardMeetingsScopePane />, keywords: [...t("settings.sections.dashboardMeetingsScope.keywords", { returnObjects: true })] },
  { key: "meeting-reminder-lead-time", label: t("settings.sections.meetingReminderLeadTime.label"), icon: AlarmClock, group: "sales", render: () => <MeetingReminderLeadTimePane />, keywords: [...t("settings.sections.meetingReminderLeadTime.keywords", { returnObjects: true })] },
  // US-SET-15/16 (D-094)
  { key: "data-export", label: t("settings.sections.dataExport.label"), icon: Download, group: "data", render: () => <DataExportPane />, keywords: [...t("settings.sections.dataExport.keywords", { returnObjects: true })] },
  { key: "data", label: t("settings.sections.data.label"), icon: Database, group: "data", render: () => <DataPane />, keywords: [...t("settings.sections.data.keywords", { returnObjects: true })] },
  // US-SET-31: Team pages, opened from here.
  { key: "users", label: t("settings.sections.users.label"), icon: UserCog, group: "team", href: "/team/users", keywords: [...t("settings.sections.users.keywords", { returnObjects: true })] },
  { key: "teams", label: t("settings.sections.teams.label"), icon: Shield, group: "team", href: "/team/teams", keywords: [...t("settings.sections.teams.keywords", { returnObjects: true })] },
  { key: "audit-log", label: t("settings.sections.auditLog.label"), icon: History, group: "team", href: "/team/audit-log", keywords: [...t("settings.sections.auditLog.keywords", { returnObjects: true })] },
  { key: "email-log", label: t("settings.sections.emailLog.label"), icon: Mails, group: "team", href: "/emails", keywords: [...t("settings.sections.emailLog.keywords", { returnObjects: true })] },
];

/** The pane Settings opens on: Business profile for Owners, Profile for everyone else (US-SET-30). */
export const firstSettingsPane = (isOwner: boolean) => (isOwner ? "business" : "profile");

/** US-SET-34 — sections whose name or contents match the search, with what matched. */
export function searchSettings(sections: SettingsSection[], query: string): { section: SettingsSection; matches: string[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections.map((section) => ({ section, matches: [] }));
  return sections
    .map((section) => {
      const hits = section.keywords.filter((k) => k.toLowerCase().includes(q));
      // "prefix" adds nothing next to "invoice prefix".
      return { section, matches: hits.filter((k) => !hits.some((other) => other !== k && other.toLowerCase().includes(k.toLowerCase()))) };
    })
    .filter(({ section, matches }) => section.label.toLowerCase().includes(q) || matches.length > 0);
}

/** Highlights the search in a phrase. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || i < 0) return <>{text}</>;
  const end = i + query.trim().length;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-due-bg px-px text-inherit">{text.slice(i, end)}</mark>
      {text.slice(end)}
    </>
  );
}

const DIRTY_ROLES = '[role="checkbox"],[role="switch"],[role="radio"],[role="option"],[role="menuitemradio"]';

/**
 * The Settings dialog (D-236): one place for everyone — Your account for
 * every role, the business's settings for Owners — grouped (US-SET-31),
 * roomy on big screens and list-then-pane on phones (US-SET-32), kept in
 * the address with a guard for unsaved changes (US-SET-33) and searchable
 * by what panes contain (US-SET-34).
 *
 * `activeKey`/`onActiveKeyChange` make the open pane controlled — the app
 * keeps it in `?settings=` (`SettingsRoute`); setup and onboarding leave
 * them out and the dialog keeps its own.
 *
 * `isOwner` decides which groups are listed. It's a convenience, not the
 * security boundary: every business settings write is Owner-only on the API.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  isOwner,
  initialKey,
  activeKey: controlledKey,
  onActiveKeyChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
  /** US-SET-15: open on this pane (e.g. "data-export"). */
  initialKey?: string | null;
  activeKey?: string | null;
  onActiveKeyChange?: (key: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [ownKey, setOwnKey] = useState<string>(firstSettingsPane(isOwner));
  // US-SET-32: on a phone, the list first, then a pane.
  const [showPane, setShowPane] = useState(false);
  const [dirty, setDirty] = useState(false);
  // US-TAX-12 — re-read on each pane change, so choosing India under Tax shows GST.
  const [country, setCountry] = useState<string | null>(null);
  const requestedKey = controlledKey ?? ownKey;
  useEffect(() => {
    if (!open || !isOwner) return;
    apiClient
      .get<TaxProfile>("/org/tax/profile")
      .then((p) => setCountry(p.country ?? null))
      .catch(() => {});
  }, [open, isOwner, requestedKey]);
  useEffect(() => {
    if (open && initialKey) setOwnKey(initialKey);
  }, [open, initialKey]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDirty(false);
      setShowPane(false);
    }
  }, [open]);

  // US-SET-24: a switched-off module's settings panes are gone; Staff and Field see Your account only.
  const { modules } = useModules();
  // Your account needs the signed-in person (the app layout); onboarding has only the business's panes.
  const { available: hasAccount } = useAccount();
  const sections = useMemo(
    () =>
      SETTINGS_SECTIONS.filter(
        (s) =>
          (s.group === "account" ? hasAccount : isOwner) &&
          (!s.country || s.country === country || s.key === requestedKey) &&
          !ownedByOffModule(modules, "settingsPanes", s.key),
      ),
    [isOwner, hasAccount, country, requestedKey, modules],
  );
  const results = useMemo(() => searchSettings(sections, query), [sections, query]);
  // US-SET-33: an unknown pane, or one this person can't open, opens their first pane.
  const active = sections.find((s) => s.key === requestedKey && s.render) ?? sections.find((s) => s.key === firstSettingsPane(isOwner)) ?? sections[0]!;
  // Not while the modules are still loading: a link to a module's pane (US-MCP-04) opens once they arrive.
  useEffect(() => {
    if (open && controlledKey && modules !== null && controlledKey !== active.key) onActiveKeyChange?.(active.key);
  }, [open, controlledKey, active.key, onActiveKeyChange, modules]);

  const markSaved = useCallback(() => setDirty(false), []);

  // US-SET-31: the open pane's row stays in view, however short the window.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => listRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [open, active.key]);

  /** Asks before unsaved changes are dropped; true when it's fine to go on. */
  async function canLeave(): Promise<boolean> {
    if (!dirty) return true;
    const ok = await confirm({
      title: t("settings.dialog.discardConfirm.title", { section: active.label }),
      description: t("settings.dialog.discardConfirm.description"),
      confirmLabel: t("settings.dialog.discardConfirm.confirm"),
      cancelLabel: t("settings.dialog.discardConfirm.cancel"),
      danger: true,
    });
    if (ok) setDirty(false);
    return ok;
  }

  async function choose(section: SettingsSection) {
    if (section.key === active.key && !section.href) {
      setShowPane(true);
      return;
    }
    if (!(await canLeave())) return;
    if (section.href) {
      onOpenChange(false);
      router.push(section.href);
      return;
    }
    if (onActiveKeyChange) onActiveKeyChange(section.key);
    else setOwnKey(section.key);
    setShowPane(true);
    setQuery("");
  }

  async function requestClose(next: boolean) {
    if (next) return onOpenChange(true);
    if (await canLeave()) onOpenChange(false);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!query.trim()) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      void choose(results[cursor].section);
    }
  }
  useEffect(() => setCursor(0), [query]);

  // Bubble phase, once: setting state before the field handles its own change drops the first keystroke.
  function markDirty(e: React.SyntheticEvent) {
    if (dirty || active.savesOnChange) return;
    // Typing in a dialog opened from the pane (Change email, a crop) isn't the pane's own change.
    const host = e.target instanceof Element ? e.target.closest('[role="dialog"],[role="alertdialog"]') : null;
    if (host && host !== (e.currentTarget as Element).closest('[role="dialog"]')) return;
    if (e.type === "input" || (e.target instanceof Element && e.target.closest(DIRTY_ROLES))) setDirty(true);
  }

  const searching = Boolean(query.trim());

  return (
    <Dialog open={open} onOpenChange={(next) => void requestClose(next)}>
      <DialogContent size="xl" aria-describedby={undefined} data-testid="settings-dialog">
        <DialogTitle className="sr-only">{t("settings.dialog.title")}</DialogTitle>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={t("settings.dialog.sectionsNav")} className={cn("flex w-full shrink-0 flex-col gap-2 border-border px-3 py-4 md:w-66 md:border-r", showPane && "max-md:hidden")}>
            <p className="pr-10 text-[16px] font-semibold text-on-surface md:hidden">{t("settings.dialog.title")}</p>
            <div className="relative">
              <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} placeholder={t("settings.dialog.searchPlaceholder")} aria-label={t("settings.dialog.searchPlaceholder")} className="h-8.5 pl-8 text-[13px]" />
            </div>
            <div ref={listRef} className="-mx-1 flex min-h-0 flex-col gap-px overflow-y-auto px-1" data-testid="settings-sections">
              {SETTINGS_GROUPS.map((group) => {
                const inGroup = results.filter((r) => r.section.group === group.key);
                if (inGroup.length === 0) return null;
                return (
                  <Fragment key={group.key}>
                    <span className="shrink-0 px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted first:pt-1">{group.label}</span>
                    {inGroup.map(({ section, matches }) => {
                      const on = section.key === active.key && !searching;
                      const focused = searching && results[cursor]?.section.key === section.key;
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => void choose(section)}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            // Fixed heights (US-SET-31): 30px rows, 44px touch targets on a phone; two lines when search shows what matched.
                            "flex shrink-0 items-center gap-2.25 rounded-sm px-2 text-left text-[13px] transition-colors",
                            searching && matches.length > 0 ? "py-1.5" : "h-11 md:h-7.5",
                            on || focused ? "bg-info-bg font-semibold text-primary" : "text-on-surface hover:bg-surface-sunken",
                          )}
                        >
                          <Icon size={15} aria-hidden className={cn("shrink-0", on || focused ? "text-primary" : "text-on-surface-muted")} />
                          <span className="min-w-0 flex-1">
                            {section.label}
                            {searching && matches.length > 0 && (
                              <span className="block text-[11.5px] font-normal text-on-surface-muted">
                                {t("settings.dialog.matches")}{" "}
                                {matches.slice(0, 3).map((m, i) => (
                                  <Fragment key={m}>
                                    {i > 0 && ", "}
                                    <Highlight text={m} query={query} />
                                  </Fragment>
                                ))}
                              </span>
                            )}
                          </span>
                          {section.key === active.key && dirty && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-due" aria-hidden data-testid="settings-unsaved-dot" />
                          )}
                          {section.key === active.key && dirty && <span className="sr-only">{t("settings.dialog.edited")}</span>}
                          {section.href ? <ArrowUpRight size={14} aria-hidden className="shrink-0 text-on-surface-muted" /> : <ChevronRight size={15} aria-hidden className="shrink-0 text-on-surface-muted md:hidden" />}
                        </button>
                      );
                    })}
                  </Fragment>
                );
              })}
              {results.length === 0 && (
                <div className="flex flex-col items-start gap-2 px-2 py-1.5">
                  <span className="text-[13px] text-on-surface-muted">{t("settings.dialog.noMatches")}</span>
                  <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                    {t("settings.dialog.clearSearch")}
                  </Button>
                </div>
              )}
            </div>
          </nav>
          <div className={cn("min-w-0 flex-1 overflow-y-auto p-6 max-md:p-4", !showPane && "max-md:hidden")} data-testid="settings-pane" onInput={markDirty} onClick={markDirty}>
            <Button variant="ghost" size="sm" className="mb-3 -ml-2 md:hidden" onClick={() => setShowPane(false)}>
              <ChevronLeft size={16} aria-hidden />
              {t("settings.dialog.back")}
            </Button>
            <SettingsDirtyContext.Provider value={{ markSaved }}>
              <div className={cn("mx-auto w-full", active.key === "documents" ? "max-w-5xl" : "max-w-3xl")}>{active.render?.(() => onOpenChange(false))}</div>
            </SettingsDirtyContext.Provider>
          </div>
        </div>
        {dialog}
      </DialogContent>
    </Dialog>
  );
}
